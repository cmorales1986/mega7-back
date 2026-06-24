using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class APInvoicePaymentsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        public APInvoicePaymentsController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // GET: api/apinvoicepayments/by-invoice/12
        [RequirePermission(Perms.APPaymentsView)]
        [HttpGet("by-invoice/{apInvoiceId:int}")]
        public async Task<IActionResult> GetByInvoice(int apInvoiceId)
        {
            var list = await _ctx.APInvoicePayments
                .AsNoTracking()
                .Where(p => p.APInvoiceId == apInvoiceId)
                .OrderByDescending(p => p.Id)
                .Select(p => new
                {
                    p.Id,
                    p.APInvoiceId,
                    p.PaymentDate,
                    p.Amount,
                    p.Method,
                    p.Reference,
                    p.Notes,
                    p.IsCancelled,
                    p.CancelledAt,
                    p.CancelReason,
                    p.CancelledByUserId,
                    p.CreatedAt,
                    p.CreatedBy,

                    // ✅ NUEVO
                    p.TargetInstallmentId,
                    p.ApplyExcessToNext
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/apinvoicepayments/{apInvoiceId}/pay
        [RequirePermission(Perms.APPaymentsCreate)]
        [HttpPost("{apInvoiceId:int}/pay")]
        public async Task<IActionResult> Pay(int apInvoiceId, [FromBody] APInvoicePayDto dto)
        {
            var payDate = (dto.PaymentDate ?? DateTime.UtcNow).Date;
            if (!await _periods.HasOpenPeriodForDate(payDate))
                return BadRequest("No existe un período ABIERTO para la fecha del pago.");

            if (dto == null) return BadRequest("Payload inválido.");
            if (dto.Amount <= 0) return BadRequest("El monto debe ser mayor a 0.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var inv = await _ctx.APInvoices
                    .FirstOrDefaultAsync(x => x.Id == apInvoiceId);

                if (inv == null) return NotFound("CxP no existe.");

                var st = (inv.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return BadRequest("No se puede pagar: la CxP está cancelada.");
                if (st == "PAID") return BadRequest("No se puede pagar: la CxP ya está pagada.");

                // SUM pagos no cancelados (antes de insertar)
                var paidBefore = await _ctx.APInvoicePayments
                    .Where(p => p.APInvoiceId == inv.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                var remaining = inv.Total - paidBefore;
                if (remaining <= 0m) return BadRequest("La CxP ya no tiene saldo pendiente.");

                if (dto.Amount > remaining)
                    return BadRequest($"El monto no puede ser mayor al saldo. Saldo: {remaining:n0}");

                // ✅ validar cuota si viene
                if (dto.InstallmentId.HasValue)
                {
                    var insOk = await _ctx.APInvoiceInstallments
                        .AsNoTracking()
                        .AnyAsync(i => i.Id == dto.InstallmentId.Value && i.APInvoiceId == inv.Id);

                    if (!insOk)
                        return BadRequest("La cuota seleccionada no existe o no pertenece a esta CxP.");
                }

                var method = (dto.Method ?? "CASH").Trim().ToUpperInvariant();
                var allowed = new HashSet<string> { "CASH", "TRANSFER", "CHECK", "CARD", "OTHER" };
                if (!allowed.Contains(method)) method = "OTHER";

                var pay = new APInvoicePayment
                {
                    APInvoiceId = inv.Id,
                    Amount = dto.Amount,
                    PaymentDate = dto.PaymentDate ?? DateTime.UtcNow,
                    Method = method,
                    Reference = dto.Reference?.Trim(),
                    Notes = dto.Notes?.Trim(),
                    IsCancelled = false,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = User.Identity?.Name ?? "system",

                    // ✅ NUEVO (Opción B)
                    TargetInstallmentId = dto.InstallmentId,
                    ApplyExcessToNext = dto.ApplyExcessToNext
                };

                _ctx.APInvoicePayments.Add(pay);

                // paidAfter = paidBefore + dto.Amount
                var paidAfter = paidBefore + dto.Amount;

                RecalcInvoiceTotals(inv, paidAfter);
                inv.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();

                // ✅ Recalcular cuotas según pagos (con target por pago)
                await RecalculateInstallmentsFromPayments(inv.Id);

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new
                {
                    ok = true,
                    inv.Id,
                    inv.Status,
                    inv.Total,
                    inv.Balance,
                    inv.PaidAt,
                    paymentId = pay.Id
                });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/apinvoicepayments/{paymentId}/cancel
        [RequirePermission(Perms.APPaymentsCancel)]
        [HttpPost("{paymentId:int}/cancel")]
        public async Task<IActionResult> CancelPayment(int paymentId, [FromBody] APInvoiceCancelPaymentDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la cancelación del pago.");

                var pay = await _ctx.APInvoicePayments
                    .Include(p => p.APInvoice)
                    .FirstOrDefaultAsync(p => p.Id == paymentId);

                if (pay == null) return NotFound("Pago no existe.");
                if (pay.IsCancelled) return Ok(new { ok = true, message = "El pago ya estaba cancelado." });

                var inv = pay.APInvoice!;
                var st = (inv.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return BadRequest("No se puede cancelar el pago: la CxP está cancelada.");

                // Marcar pago cancelado (auditoría)
                pay.IsCancelled = true;
                pay.CancelledAt = DateTime.UtcNow;
                pay.CancelReason = dto?.Reason?.Trim();
                pay.CancelledByUserId = dto?.CancelledByUserId;
                pay.CancelledBy = User.Identity?.Name ?? "system";

                // recalcular SUM pagos no cancelados EXCLUYENDO este paymentId
                var paidSum = await _ctx.APInvoicePayments
                    .Where(p => p.APInvoiceId == inv.Id && !p.IsCancelled && p.Id != paymentId)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                RecalcInvoiceTotals(inv, paidSum);
                inv.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();

                // ✅ Recalcular cuotas luego de cancelar
                await RecalculateInstallmentsFromPayments(inv.Id);

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new
                {
                    ok = true,
                    inv.Id,
                    inv.Status,
                    inv.Total,
                    inv.Balance,
                    inv.PaidAt
                });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        private static void RecalcInvoiceTotals(APInvoice inv, decimal paidSum)
        {
            var balance = inv.Total - paidSum;
            if (balance < 0) balance = 0m;

            inv.Balance = balance;

            if ((inv.Status ?? "OPEN").ToUpperInvariant() == "CANCELLED")
                return;

            if (inv.Balance == 0m)
            {
                inv.Status = "PAID";
                inv.PaidAt ??= DateTime.UtcNow;
            }
            else if (inv.Balance < inv.Total)
            {
                inv.Status = "PARTIAL";
                inv.PaidAt = null;
            }
            else
            {
                inv.Status = "OPEN";
                inv.PaidAt = null;
            }
        }

        // =========================
        // ✅ CUOTAS: recalcular por pagos
        // - respeta TargetInstallmentId por pago
        // - si ApplyExcessToNext = true, distribuye a siguientes
        // - si no hay TargetInstallmentId => AUTO (FIFO por vencimiento/nro)
        // =========================
        private async Task RecalculateInstallmentsFromPayments(int apInvoiceId)
        {
            var installments = await _ctx.APInvoiceInstallments
                .Where(x => x.APInvoiceId == apInvoiceId)
                .OrderBy(x => x.InstallmentNo)
                .ToListAsync();

            if (installments.Count == 0) return;

            // reset cuotas
            foreach (var ins in installments)
            {
                // si manejás CANCELLED en cuotas, podrías respetarlo acá. Por ahora:
                ins.PaidAmount = 0m;
                ins.Balance = ins.Amount;
                ins.Status = "OPEN";
                ins.UpdatedAt = DateTime.UtcNow;
            }

            var pays = await _ctx.APInvoicePayments
                .AsNoTracking()
                .Where(p => p.APInvoiceId == apInvoiceId && !p.IsCancelled)
                .OrderBy(p => p.PaymentDate)
                .ThenBy(p => p.Id)
                .ToListAsync();

            // helper: índice de cuota
            int IndexOfInstallment(int id)
            {
                for (int i = 0; i < installments.Count; i++)
                    if (installments[i].Id == id) return i;
                return -1;
            }

            // helper: primer pendiente (FIFO)
            int FirstOpenIndex()
            {
                for (int i = 0; i < installments.Count; i++)
                    if (installments[i].Balance > 0m) return i;
                return -1;
            }

            foreach (var pay in pays)
            {
                var remaining = pay.Amount;
                if (remaining <= 0m) continue;

                int startIdx;

                if (pay.TargetInstallmentId.HasValue)
                {
                    startIdx = IndexOfInstallment(pay.TargetInstallmentId.Value);
                    if (startIdx < 0)
                    {
                        // si por alguna razón ya no existe esa cuota, fallback a FIFO
                        startIdx = FirstOpenIndex();
                    }
                }
                else
                {
                    startIdx = FirstOpenIndex();
                }

                if (startIdx < 0) break; // no hay cuotas con saldo

                // aplicar desde startIdx en adelante
                for (int i = startIdx; i < installments.Count; i++)
                {
                    if (remaining <= 0m) break;

                    var ins = installments[i];
                    if (ins.Balance <= 0m) continue;

                    var apply = Math.Min(ins.Balance, remaining);
                    ins.PaidAmount += apply;
                    ins.Balance -= apply;
                    remaining -= apply;

                    ins.Status = (ins.Balance <= 0m) ? "PAID" : "OPEN";
                    ins.UpdatedAt = DateTime.UtcNow;

                    // si el pago era “cuota específica” y NO permite excedente, cortamos
                    if (pay.TargetInstallmentId.HasValue && pay.ApplyExcessToNext == false)
                        break;
                }
            }
        }

    }
}
