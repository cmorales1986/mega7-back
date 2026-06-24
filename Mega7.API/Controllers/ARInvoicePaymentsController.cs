using Mega7.API.Data;
using Mega7.API.Services;
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
    public class ARInvoicePaymentsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        private readonly FiscalNumberService _fiscal;

        public ARInvoicePaymentsController(Mega7DbContext ctx, PeriodService periods, FiscalNumberService fiscal)
        {
            _ctx = ctx;
            _periods = periods;
            _fiscal = fiscal;
        }

        // GET: api/arinvoicepayments/by-invoice/12
        [HttpGet("by-invoice/{arInvoiceId:int}")]
        public async Task<IActionResult> GetByInvoice(int arInvoiceId)
        {
            var list = await _ctx.ARInvoicePayments
                .AsNoTracking()
                .Where(p => p.ARInvoiceId == arInvoiceId)
                .OrderByDescending(p => p.Id)
                .Select(p => new
                {
                    p.Id,
                    p.ARInvoiceId,
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

                    // ✅ igual a AP
                    p.TargetInstallmentId,
                    p.ApplyExcessToNext,

                    // ✅ link a recibo
                    p.ARSalesReceiptId
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/arinvoicepayments/{arInvoiceId}/pay
        [HttpPost("{arInvoiceId:int}/pay")]
        public async Task<IActionResult> Pay(int arInvoiceId, [FromBody] ARInvoicePayDto dto)
        {
            if (dto == null) return BadRequest("Payload inválido.");
            if (dto.Amount <= 0) return BadRequest("El monto debe ser mayor a 0.");

            var payDate = (dto.PaymentDate ?? DateTime.UtcNow).Date;
            if (!await _periods.HasOpenPeriodForDate(payDate))
                return BadRequest("No existe un período ABIERTO para la fecha del cobro.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                // ✅ Include Customer para snapshot RUC en recibo
                var inv = await _ctx.ARInvoices
                    .Include(x => x.Customer)
                    .FirstOrDefaultAsync(x => x.Id == arInvoiceId);

                if (inv == null) return NotFound("CxC no existe.");

                var st = (inv.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return BadRequest("No se puede cobrar: la CxC está cancelada.");
                if (st == "PAID") return BadRequest("No se puede cobrar: la CxC ya está pagada.");

                // SUM cobros no cancelados (antes de insertar)
                var paidBefore = await _ctx.ARInvoicePayments
                    .Where(p => p.ARInvoiceId == inv.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                var remaining = inv.Total - paidBefore;
                if (remaining <= 0m) return BadRequest("La CxC ya no tiene saldo pendiente.");

                if (dto.Amount > remaining)
                    return BadRequest($"El monto no puede ser mayor al saldo. Saldo: {remaining:n0}");

                // ✅ validar cuota si viene
                if (dto.InstallmentId.HasValue)
                {
                    var insOk = await _ctx.ARInvoiceInstallments
                        .AsNoTracking()
                        .AnyAsync(i => i.Id == dto.InstallmentId.Value && i.ARInvoiceId == inv.Id);

                    if (!insOk)
                        return BadRequest("La cuota seleccionada no existe o no pertenece a esta CxC.");
                }

                var method = (dto.Method ?? "CASH").Trim().ToUpperInvariant();
                var allowed = new HashSet<string> { "CASH", "TRANSFER", "CHECK", "CARD", "OTHER" };
                if (!allowed.Contains(method)) method = "OTHER";

                var pay = new ARInvoicePayment
                {
                    ARInvoiceId = inv.Id,
                    Amount = dto.Amount,
                    PaymentDate = dto.PaymentDate ?? DateTime.UtcNow,
                    Method = method,
                    Reference = dto.Reference?.Trim(),
                    Notes = dto.Notes?.Trim(),
                    IsCancelled = false,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = User.Identity?.Name ?? "system",

                    // ✅ igual a AP
                    TargetInstallmentId = dto.InstallmentId,
                    ApplyExcessToNext = dto.ApplyExcessToNext
                };

                _ctx.ARInvoicePayments.Add(pay);

                // =========================
                // ✅ CREAR RECIBO (por ahora 1 pago → 1 factura)
                // Luego, cuando hagamos “un cobro para varias facturas”,
                // este bloque se moverá a un endpoint de Recibo (cabecera + N líneas).
                // =========================
                var res = await _fiscal.ReserveAsync("RECIBO", onDate: pay.PaymentDate.Date);

                var receipt = new ARSalesReceipt
                {
                    ReceiptDate = pay.PaymentDate,

                    CustomerId = inv.CustomerId,
                    CustomerName = inv.CustomerName,
                    CustomerRuc = inv.Customer?.RUC, // ajustá si tu campo se llama distinto

                    PaymentMethod = method,
                    PaymentReference = pay.Reference,
                    Notes = pay.Notes,

                    TotalReceived = pay.Amount,

                    FiscalDocType = "RECIBO",
                    FiscalSeriesId = res.SeriesId,
                    FiscalTimbrado = res.Timbrado,
                    FiscalEstablishment = res.Establishment,
                    FiscalExpeditionPoint = res.ExpeditionPoint,
                    FiscalNumber = res.Number,
                    FiscalFullNumber = res.FullNumber,

                    CreatedAt = DateTime.UtcNow
                };

                _ctx.Add(receipt);
                await _ctx.SaveChangesAsync(); // para obtener receipt.Id

                _ctx.Add(new ARSalesReceiptLine
                {
                    ARSalesReceiptId = receipt.Id,
                    ARInvoiceId = inv.Id,
                    AppliedAmount = pay.Amount,
                    InvoiceDocNumber = inv.DocNumber,
                    InvoiceFiscalNumber = inv.FiscalFullNumber
                });

                // link pago → recibo
                pay.ARSalesReceiptId = receipt.Id;

                // =========================
                // Recalcular invoice
                // =========================
                var paidAfter = paidBefore + dto.Amount;

                RecalcInvoiceTotals(inv, paidAfter);
                inv.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();

                // ✅ Recalcular cuotas según cobros
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
                    paymentId = pay.Id,
                    receiptId = receipt.Id,
                    receiptFiscalNumber = receipt.FiscalFullNumber
                });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/arinvoicepayments/{paymentId}/cancel
        [HttpPost("{paymentId:int}/cancel")]
        public async Task<IActionResult> CancelPayment(int paymentId, [FromBody] ARInvoiceCancelPaymentDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la cancelación del cobro.");

                var pay = await _ctx.ARInvoicePayments
                    .Include(p => p.ARInvoice)
                    .FirstOrDefaultAsync(p => p.Id == paymentId);

                if (pay == null) return NotFound("Cobro no existe.");
                if (pay.IsCancelled) return Ok(new { ok = true, message = "El cobro ya estaba cancelado." });

                var inv = pay.ARInvoice!;
                var st = (inv.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return BadRequest("No se puede cancelar el cobro: la CxC está cancelada.");

                // Marcar cobro cancelado (auditoría)
                pay.IsCancelled = true;
                pay.CancelledAt = DateTime.UtcNow;
                pay.CancelReason = dto?.Reason?.Trim();
                pay.CancelledByUserId = dto?.CancelledByUserId;
                pay.CancelledBy = User.Identity?.Name ?? "system";

                // recalcular SUM cobros no cancelados EXCLUYENDO este paymentId
                var paidSum = await _ctx.ARInvoicePayments
                    .Where(p => p.ARInvoiceId == inv.Id && !p.IsCancelled && p.Id != paymentId)
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

        private static void RecalcInvoiceTotals(ARInvoice inv, decimal paidSum)
        {
            var balance = inv.Total - paidSum;
            if (balance < 0) balance = 0m;

            inv.PaidAmount = paidSum;
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
        // ✅ CUOTAS: recalcular por cobros
        // - respeta TargetInstallmentId por cobro
        // - si ApplyExcessToNext = true, distribuye a siguientes
        // - si no hay TargetInstallmentId => AUTO (FIFO)
        // =========================
        private async Task RecalculateInstallmentsFromPayments(int arInvoiceId)
        {
            var installments = await _ctx.ARInvoiceInstallments
                .Where(x => x.ARInvoiceId == arInvoiceId)
                .OrderBy(x => x.Number)
                .ToListAsync();

            if (installments.Count == 0) return;

            // reset
            foreach (var ins in installments)
            {
                ins.PaidAmount = 0m;
                ins.Balance = ins.Amount;
                ins.IsPaid = false;
            }

            var pays = await _ctx.ARInvoicePayments
                .AsNoTracking()
                .Where(p => p.ARInvoiceId == arInvoiceId && !p.IsCancelled)
                .OrderBy(p => p.PaymentDate)
                .ThenBy(p => p.Id)
                .ToListAsync();

            int IndexOfInstallment(int id)
            {
                for (int i = 0; i < installments.Count; i++)
                    if (installments[i].Id == id) return i;
                return -1;
            }

            int FirstOpenIndex()
            {
                for (int i = 0; i < installments.Count; i++)
                    if (installments[i].Balance > 0m) return i;
                return -1;
            }

            foreach (var p in pays)
            {
                var remaining = p.Amount;
                if (remaining <= 0m) continue;

                int startIdx;

                if (p.TargetInstallmentId.HasValue)
                {
                    startIdx = IndexOfInstallment(p.TargetInstallmentId.Value);
                    if (startIdx < 0) startIdx = FirstOpenIndex();
                }
                else
                {
                    startIdx = FirstOpenIndex();
                }

                if (startIdx < 0) break;

                for (int i = startIdx; i < installments.Count; i++)
                {
                    if (remaining <= 0m) break;

                    var ins = installments[i];
                    if (ins.Balance <= 0m) continue;

                    var apply = Math.Min(ins.Balance, remaining);
                    ins.PaidAmount += apply;
                    ins.Balance -= apply;
                    remaining -= apply;

                    ins.IsPaid = (ins.Balance <= 0m);

                    // si era “cuota específica” y NO permite excedente, cortamos
                    if (p.TargetInstallmentId.HasValue && p.ApplyExcessToNext == false)
                        break;
                }
            }
        }
    }
}
