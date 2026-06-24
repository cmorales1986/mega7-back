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
    public class ARInvoicesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public ARInvoicesController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // GET: api/arinvoices?status=OPEN&includeCancelled=false
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null, [FromQuery] bool includeCancelled = false)
        {
            var q = _ctx.ARInvoices
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .AsQueryable();

            if (!includeCancelled)
                q = q.Where(x => (x.Status ?? "OPEN").ToUpper() != "CANCELLED");

            if (!string.IsNullOrWhiteSpace(status))
            {
                var st = status.Trim().ToUpperInvariant();
                q = q.Where(x => (x.Status ?? "OPEN").ToUpper() == st);
            }

            var list = await q.Select(x => new
            {
                x.Id,
                x.SalesOrderId,
                x.CustomerId,
                x.CustomerName,
                x.DocNumber,
                x.InvoiceDate,
                x.DueDate,
                x.Total,
                x.Balance,
                x.Status,
                x.CreatedAt,
                x.UpdatedAt,

                IsCancelled = (x.Status ?? "OPEN").ToUpper() == "CANCELLED",
                IsPaid = (x.Status ?? "OPEN").ToUpper() == "PAID",
                IsPartial = (x.Status ?? "OPEN").ToUpper() == "PARTIAL",
                IsOpen = (x.Status ?? "OPEN").ToUpper() == "OPEN",
                IsOverdue = x.DueDate.HasValue
                    && x.DueDate.Value.Date < DateTime.UtcNow.Date
                    && (x.Status ?? "OPEN").ToUpper() != "PAID"
                    && (x.Status ?? "OPEN").ToUpper() != "CANCELLED",

                x.CancelledAt,
                x.CancelReason
            }).ToListAsync();

            return Ok(list);
        }

        // GET: api/arinvoices/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var x = await _ctx.ARInvoices
                .AsNoTracking()
                .Where(a => a.Id == id)
                .Select(a => new
                {
                    a.Id,
                    a.SalesOrderId,
                    a.CustomerId,
                    a.CustomerName,
                    a.DocNumber,
                    a.InvoiceDate,
                    a.DueDate,
                    a.Total,
                    a.Balance,
                    a.Status,
                    a.CreatedAt,
                    a.UpdatedAt,
                    IsCancelled = (a.Status ?? "OPEN").ToUpper() == "CANCELLED",
                    a.CancelledAt,
                    a.CancelReason
                })
                .FirstOrDefaultAsync();

            if (x == null) return NotFound();
            return Ok(x);
        }

        // GET: api/arinvoices/by-sales-order/123
        [HttpGet("by-sales-order/{salesOrderId:int}")]
        public async Task<IActionResult> GetBySalesOrder(int salesOrderId)
        {
            var x = await _ctx.ARInvoices
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.SalesOrderId == salesOrderId);

            if (x == null) return NotFound();
            return Ok(x);
        }

        // GET: api/arinvoices/{id}/installments
        [HttpGet("{id:int}/installments")]
        public async Task<IActionResult> GetInstallments(int id)
        {
            var list = await _ctx.ARInvoiceInstallments
                .AsNoTracking()
                .Where(x => x.ARInvoiceId == id)
                .OrderBy(x => x.Number)
                .Select(x => new
                {
                    x.Id,
                    x.ARInvoiceId,
                    InstallmentNo = x.Number,
                    x.DueDate,
                    x.Amount,
                    x.PaidAmount,
                    x.Balance,
                    Status = x.IsPaid ? "PAID" : "OPEN",
                    x.CreatedAt,
                    x.UpdatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/arinvoices/{id}/installments/generate
        // Body: ARInvoiceGenerateInstallmentsDto
        // Reglas:
        // - Count <= 1 => crédito simple (SIN cuotas), solo DueDate
        // - Count >= 2 => genera cuotas parejas (ajuste en la última) y DueDate = última cuota
        // - Soporta 2 esquemas: INTERVAL y DAY_OF_MONTH (clamp al último día del mes)
        [HttpPost("{id:int}/installments/generate")]
        public async Task<IActionResult> GenerateInstallments(int id, [FromBody] ARInvoiceGenerateInstallmentsDto dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var count = dto.Count;
                var creditDays = dto.CreditDays;

                if (count <= 0) return BadRequest("Count debe ser >= 1.");
                if (count > 60) return BadRequest("Count demasiado grande.");
                if (creditDays < 0) creditDays = 0;

                var ar = await _ctx.ARInvoices.FirstOrDefaultAsync(x => x.Id == id);
                if (ar == null) return NotFound("CxC no existe.");

                if (!await _periods.HasOpenPeriodForDate(ar.InvoiceDate))
                    return BadRequest("No existe un período ABIERTO para la fecha de la factura (CxC).");

                var st = (ar.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return BadRequest("No se puede: CxC cancelada.");
                if (st == "PAID") return BadRequest("No se puede: CxC pagada.");
                if (st == "PARTIAL") return BadRequest("No se puede regenerar cuotas: CxC parcial (tiene cobros).");

                var paidSum = await _ctx.ARInvoicePayments
                    .Where(p => p.ARInvoiceId == ar.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                if (paidSum > 0m)
                    return BadRequest("No se puede generar cuotas: existen cobros registrados.");

                // borrar cuotas previas
                var prev = await _ctx.ARInvoiceInstallments
                    .Where(x => x.ARInvoiceId == ar.Id)
                    .ToListAsync();

                if (prev.Count > 0)
                    _ctx.ARInvoiceInstallments.RemoveRange(prev);

                // ✅ CRÉDITO SIMPLE: SIN CUOTAS
                if (count <= 1)
                {
                    var due = ar.InvoiceDate.Date.AddDays(creditDays);

                    ar.DueDate = due;
                    ar.Balance = ar.Total;
                    ar.Status = "OPEN";
                    ar.UpdatedAt = DateTime.UtcNow;

                    await _ctx.SaveChangesAsync();
                    await trx.CommitAsync();

                    return Ok(new { ok = true, ar.Id, ar.DueDate, installments = 0 });
                }

                // ✅ CUOTAS (count >= 2)
                var scheduleType = (dto.InstallmentScheduleType ?? "INTERVAL").Trim().ToUpperInvariant();

                // baseFirst:
                // - si viene FirstDueDate => usamos su mes como ancla
                // - si no => invoiceDate + creditDays
                var baseFirst = dto.FirstDueDate?.Date ?? ar.InvoiceDate.Date.AddDays(creditDays);

                var total = ar.Total;

                // monto base truncado 2 dec, última ajusta
                var baseAmount = Math.Floor((double)(total / count) * 100) / 100;
                var baseDec = (decimal)baseAmount;

                decimal acc = 0m;

                if (scheduleType == "DAY_OF_MONTH")
                {
                    if (dto.DueDayOfMonth == null)
                        return BadRequest("DueDayOfMonth es requerido cuando InstallmentScheduleType = DAY_OF_MONTH.");

                    var dueDay = dto.DueDayOfMonth.Value;
                    if (dueDay < 1 || dueDay > 31)
                        return BadRequest("DueDayOfMonth debe estar entre 1 y 31.");

                    // firstDue con regla AUTO/NEXT_MONTH
                    var firstDue = ComputeFirstDueFixedDay(baseFirst, dueDay, dto.FirstDueRule);

                    for (var i = 1; i <= count; i++)
                    {
                        var amount = (i == count) ? (total - acc) : baseDec;
                        acc += amount;

                        var m = firstDue.AddMonths(i - 1);
                        var due = ClampDueDay(m.Year, m.Month, dueDay);

                        _ctx.ARInvoiceInstallments.Add(new ARInvoiceInstallment
                        {
                            ARInvoiceId = ar.Id,
                            Number = i,
                            DueDate = due,
                            Amount = amount,
                            PaidAmount = 0m,
                            Balance = amount,
                            IsPaid = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // DueDate de factura = última cuota
                    var lastMonth = firstDue.AddMonths(count - 1);
                    ar.DueDate = ClampDueDay(lastMonth.Year, lastMonth.Month, dueDay);
                }
                else
                {
                    // INTERVAL (cada X días)
                    var interval = dto.IntervalDays.GetValueOrDefault(30);
                    if (interval <= 0) interval = 30;

                    for (var i = 1; i <= count; i++)
                    {
                        var amount = (i == count) ? (total - acc) : baseDec;
                        acc += amount;

                        var due = baseFirst.AddDays(interval * (i - 1));

                        _ctx.ARInvoiceInstallments.Add(new ARInvoiceInstallment
                        {
                            ARInvoiceId = ar.Id,
                            Number = i,
                            DueDate = due,
                            Amount = amount,
                            PaidAmount = 0m,
                            Balance = amount,
                            IsPaid = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    ar.DueDate = baseFirst.AddDays(interval * (count - 1));
                }

                ar.Balance = ar.Total;
                ar.Status = "OPEN";
                ar.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ar.Id, ar.DueDate, installments = count });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/arinvoices/{id}/cancel
        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] ARInvoiceCancelDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var ar = await _ctx.ARInvoices.FirstOrDefaultAsync(x => x.Id == id);
                if (ar == null) return NotFound("CxC no existe.");

                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la operación.");

                var st = (ar.Status ?? "OPEN").ToUpperInvariant();

                if (st == "CANCELLED")
                    return Ok(new { ok = true, ar.Id, ar.Status });

                if (st == "PAID")
                    return BadRequest("No se puede cancelar: la CxC está pagada.");

                if (st == "PARTIAL" || ar.Balance < ar.Total)
                    return BadRequest("No se puede cancelar: la CxC tiene cobros o saldo parcial.");

                ar.Status = "CANCELLED";
                ar.CancelledAt = DateTime.UtcNow;
                ar.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason)
                    ? "Cancelado manualmente."
                    : dto!.Reason!.Trim();

                ar.Balance = 0m;
                ar.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ar.Id, ar.Status, ar.Balance, ar.CancelledAt, ar.CancelReason });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/arinvoices/{id}/reopen
        [HttpPost("{id:int}/reopen")]
        public async Task<IActionResult> Reopen(int id, [FromBody] ARInvoiceReopenDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var ar = await _ctx.ARInvoices.FirstOrDefaultAsync(x => x.Id == id);
                if (ar == null) return NotFound("CxC no existe.");

                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la operación.");

                var st = (ar.Status ?? "OPEN").ToUpperInvariant();

                if (st != "CANCELLED")
                    return BadRequest("Solo se puede reabrir una CxC en estado CANCELLED.");

                if (ar.Balance < ar.Total)
                    return BadRequest("No se puede reabrir: la CxC tiene cobros registrados.");

                ar.Status = "OPEN";
                ar.CancelledAt = null;
                ar.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason) ? null : dto!.Reason!.Trim();
                ar.Balance = ar.Total;
                ar.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ar.Id, ar.Status, ar.Balance });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // ==========================================
        // RECALC CUOTAS EN BASE A COBROS (FIFO)
        // ==========================================
        private async Task RecalculateInstallmentsFromPayments(int arInvoiceId)
        {
            var installments = await _ctx.ARInvoiceInstallments
                .Where(x => x.ARInvoiceId == arInvoiceId)
                .OrderBy(x => x.Number)
                .ToListAsync();

            if (installments.Count == 0) return;

            foreach (var ins in installments)
            {
                ins.PaidAmount = 0m;
                ins.Balance = ins.Amount;
                ins.IsPaid = false;
                ins.UpdatedAt = DateTime.UtcNow;
            }

            var payments = await _ctx.ARInvoicePayments
                .AsNoTracking()
                .Where(p => p.ARInvoiceId == arInvoiceId && !p.IsCancelled)
                .OrderBy(p => p.PaymentDate)
                .ThenBy(p => p.Id)
                .ToListAsync();

            foreach (var pay in payments)
            {
                var remaining = pay.Amount;

                foreach (var ins in installments)
                {
                    if (remaining <= 0) break;
                    if (ins.Balance <= 0) continue;

                    var apply = Math.Min(ins.Balance, remaining);
                    ins.PaidAmount += apply;
                    ins.Balance -= apply;
                    remaining -= apply;

                    ins.IsPaid = ins.Balance <= 0;
                    ins.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        // ===== Helpers para DAY_OF_MONTH =====
        private static DateTime ClampDueDay(int year, int month, int dueDay)
        {
            if (dueDay < 1) dueDay = 1;
            if (dueDay > 31) dueDay = 31;

            var last = DateTime.DaysInMonth(year, month);
            var d = Math.Min(dueDay, last);
            return new DateTime(year, month, d);
        }

        private static DateTime ComputeFirstDueFixedDay(DateTime baseDate, int dueDay, string? firstDueRule)
        {
            var rule = (firstDueRule ?? "AUTO").Trim().ToUpperInvariant();

            if (rule == "NEXT_MONTH")
            {
                var nm = baseDate.AddMonths(1);
                return ClampDueDay(nm.Year, nm.Month, dueDay);
            }

            var candidate = ClampDueDay(baseDate.Year, baseDate.Month, dueDay);

            if (baseDate.Day > dueDay)
            {
                var nm = baseDate.AddMonths(1);
                candidate = ClampDueDay(nm.Year, nm.Month, dueDay);
            }

            return candidate;
        }
    }
}
