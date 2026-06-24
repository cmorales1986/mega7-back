using Mega7.API.Data;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Mega7.SHARED.Enums;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Mega7.API.Services
{
    public class SalesPricingService
    {
        private readonly Mega7DbContext _ctx;

        public SalesPricingService(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        public async Task<PriceCalcResult> CalculateAsync(PriceCalcRequest req)
        {
            if (req == null) throw new ArgumentNullException(nameof(req));
            if (req.Cost < 0) throw new ArgumentException("Cost inválido.");

            // 1) Params efectivos (cliente -> global)
            var globalParams = await _ctx.SalesPricingParams
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CustomerId == null && x.IsActive);

            var customerParams = req.CustomerId == null
                ? null
                : await _ctx.SalesPricingParams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.CustomerId == req.CustomerId && x.IsActive);

            var p = customerParams ?? globalParams ?? new SalesPricingParams(); // fallback “todo 0”

            // 2) Markup según tipo
            decimal markupPct = 0m;
            string ruleInfo = "";

            if (req.PaymentType == PaymentType.Cash)
            {
                markupPct = p.CashMarkupPct;
                ruleInfo = $"CASH: CashMarkupPct={markupPct}%";
            }
            else if (req.PaymentType == PaymentType.Credit)
            {
                if (req.CreditTermId == null)
                    throw new ArgumentException("CreditTermId requerido para crédito.");

                // Si el cliente tiene al menos una regla, usamos reglas del cliente; sino global.
                var useCustomerRules = req.CustomerId != null && await _ctx.CreditTermMarkups
                    .AsNoTracking()
                    .AnyAsync(x => x.CustomerId == req.CustomerId && x.IsActive);

                var rule = await _ctx.CreditTermMarkups
                    .AsNoTracking()
                    .Where(x => x.IsActive
                        && x.CreditTermId == req.CreditTermId.Value
                        && x.CustomerId == (useCustomerRules ? req.CustomerId : null))
                    .FirstOrDefaultAsync();

                markupPct = rule?.MarkupPct ?? p.CreditDefaultMarkupPct;

                ruleInfo = rule != null
                    ? $"CREDIT: termId={req.CreditTermId} => {rule.MarkupPct}% (scope={(useCustomerRules ? "customer" : "global")})"
                    : $"CREDIT: termId={req.CreditTermId} => fallback CreditDefaultMarkupPct={p.CreditDefaultMarkupPct}%";
            }
            else // Installments
            {
                var n = req.InstallmentsCount ?? 0;
                if (n <= 0) throw new ArgumentException("InstallmentsCount requerido (>0) para cuotas.");

                var interval = req.InstallmentIntervalDays;

                var useCustomerRules = req.CustomerId != null && await _ctx.InstallmentMarkupRules
                    .AsNoTracking()
                    .AnyAsync(x => x.CustomerId == req.CustomerId && x.IsActive);

                var q = _ctx.InstallmentMarkupRules.AsNoTracking()
                    .Where(x => x.IsActive && x.CustomerId == (useCustomerRules ? req.CustomerId : null));

                // si hay interval, preferimos match exacto; si no, aceptamos null
                if (interval.HasValue)
                {
                    q = q.Where(x => x.IntervalDays == null || x.IntervalDays == interval.Value);
                }

                var rule = await q
                    .Where(x => n >= x.MinInstallments && n <= x.MaxInstallments)
                    .OrderByDescending(x => x.IntervalDays.HasValue) // prioriza reglas con interval definido
                    .ThenBy(x => x.SortOrder)
                    .ThenBy(x => x.MinInstallments)
                    .FirstOrDefaultAsync();

                markupPct = rule?.MarkupPct ?? p.InstallmentDefaultMarkupPct;

                ruleInfo = rule != null
                    ? $"INSTALL: n={n}, interval={interval} => rule[{rule.MinInstallments}-{rule.MaxInstallments}]={rule.MarkupPct}% (intervalRule={rule.IntervalDays}) (scope={(useCustomerRules ? "customer" : "global")})"
                    : $"INSTALL: n={n}, interval={interval} => fallback InstallmentDefaultMarkupPct={p.InstallmentDefaultMarkupPct}%";
            }

            // 3) Precio sugerido
            var markupAmount = RoundMoney(req.Cost * (markupPct / 100m));
            var priceSuggested = RoundMoney(req.Cost + markupAmount);

            // 4) Mora (SOLO cuotas / installments)
            // - Mora es MONTO por día (LateFeeAmountPerDay)
            // - Aplica días de gracia (LateFeeGraceDays)
            // - Aplica tope por monto (LateFeeCapAmount)
            // - NO aplica a crédito normal vencido
            int daysLate = 0;
            int daysLateAfterGrace = 0;
            decimal lateFeeAmount = 0m;

            if (req.PaymentType == PaymentType.Installments && req.DueDate.HasValue)
            {
                var payDate = (req.PaymentDate ?? DateTime.UtcNow).Date;
                var due = req.DueDate.Value.Date;

                daysLate = Math.Max(0, (payDate - due).Days);

                // aplica gracia
                daysLateAfterGrace = Math.Max(0, daysLate - Math.Max(0, p.LateFeeGraceDays));

                if (daysLateAfterGrace > 0 && p.LateFeeAmountPerDay > 0m)
                {
                    lateFeeAmount = RoundMoney(daysLateAfterGrace * p.LateFeeAmountPerDay);

                    ruleInfo += $" | LATE(INSTALL): daysLate={daysLate}, grace={p.LateFeeGraceDays}, chargedDays={daysLateAfterGrace}, amountPerDay={p.LateFeeAmountPerDay}";
                }

                // tope opcional por monto
                if (p.LateFeeCapAmount > 0m && lateFeeAmount > p.LateFeeCapAmount)
                {
                    lateFeeAmount = p.LateFeeCapAmount;
                    ruleInfo += $" | LATE CAP: capAmount={p.LateFeeCapAmount}";
                }
            }
            else
            {
                // explícito para evitar confusiones en logs
                if (req.DueDate.HasValue && req.PaymentType == PaymentType.Credit)
                    ruleInfo += " | LATE: skipped (credit invoices do not apply late fee)";
            }

            var total = RoundMoney(priceSuggested + lateFeeAmount);

            return new PriceCalcResult
            {
                BaseCost = req.Cost,
                MarkupPctApplied = markupPct,
                MarkupAmount = markupAmount,
                PriceSuggested = priceSuggested,

                DaysLate = daysLate,
                ChargedLateDays = daysLateAfterGrace,
                LateFeeAmount = lateFeeAmount,

                Total = total,
                RuleInfo = ruleInfo
            };


        }

        /// <summary>
        /// Redondeo típico para Paraguay (Gs): 0 decimales.
        /// Ajustá si vas a usar USD con centavos.
        /// </summary>
        private static decimal RoundMoney(decimal v)
            => Math.Round(v, 0, MidpointRounding.AwayFromZero);
    }
}
