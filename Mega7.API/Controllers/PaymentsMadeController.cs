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
    public class PaymentsMadeController : ControllerBase
    {
        private const string STATUS_VIGENTE = "VIGENTE";
        private const string STATUS_ANULADO = "ANULADO";

        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public PaymentsMadeController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // GET: api/paymentsmade
        [RequirePermission(Perms.PaymentsMadeView)]
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool includeCancelled = false)
        {
            var q = _ctx.PaymentsMade
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .AsQueryable();

            if (!includeCancelled)
                q = q.Where(x => (x.Status ?? STATUS_VIGENTE).ToUpper() != STATUS_ANULADO);

            var list = await q.Select(x => new
            {
                x.Id,
                x.PaymentDate,
                x.SupplierId,
                x.PayeeName,

                // ✅ nuevo: concepto
                x.PaymentConceptId,
                ConceptName = _ctx.PaymentConcepts
                    .Where(c => c.Id == x.PaymentConceptId)
                    .Select(c => c.Name)
                    .FirstOrDefault(),

                x.Method,
                x.Reference,
                x.TotalAmount,
                x.Status,
                x.CreatedAt,
                x.CancelledAt,

                HasApplies = _ctx.PaymentMadeApplies.Any(a => a.PaymentMadeId == x.Id),
            }).ToListAsync();

            return Ok(list);
        }

        // GET: api/paymentsmade/5
        [RequirePermission(Perms.PaymentsMadeView)]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var x = await _ctx.PaymentsMade
                .AsNoTracking()
                .Where(p => p.Id == id)
                .Select(p => new
                {
                    p.Id,
                    p.PaymentDate,
                    p.SupplierId,
                    p.PayeeName,

                    // ✅ nuevo: concepto
                    p.PaymentConceptId,
                    ConceptName = _ctx.PaymentConcepts
                        .Where(c => c.Id == p.PaymentConceptId)
                        .Select(c => c.Name)
                        .FirstOrDefault(),

                    p.Method,
                    p.Reference,
                    p.Notes,
                    p.TotalAmount,
                    p.Status,
                    p.CreatedAt,
                    p.CreatedBy,
                    p.CancelledAt,
                    p.CancelReason,
                    p.CancelledBy
                })
                .FirstOrDefaultAsync();

            if (x == null) return NotFound();

            var applies = await _ctx.PaymentMadeApplies
                .AsNoTracking()
                .Where(a => a.PaymentMadeId == id)
                .OrderBy(a => a.Id)
                .Select(a => new
                {
                    a.Id,
                    a.APInvoiceId,
                    a.Amount,
                    a.TargetInstallmentId,
                    a.ApplyExcessToNext
                })
                .ToListAsync();

            return Ok(new { doc = x, applies });
        }

        // POST: api/paymentsmade
        [RequirePermission(Perms.PaymentsMadeView)]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] PaymentMadeCreateDto dto)
        {
            if (dto == null) return BadRequest("Payload inválido.");

            var payDate = (dto.PaymentDate ?? DateTime.UtcNow).Date;
            if (!await _periods.HasOpenPeriodForDate(payDate))
                return BadRequest("No existe un período ABIERTO para la fecha del pago.");

            // ✅ método
            var method = (dto.Method ?? "CASH").Trim().ToUpperInvariant();
            var allowedMethods = new HashSet<string> { "CASH", "TRANSFER", "CHECK", "CARD", "OTHER" };
            if (!allowedMethods.Contains(method)) method = "OTHER";

            // ✅ concepto (obligatorio)
            if (dto.PaymentConceptId <= 0)
                return BadRequest("Debe indicar PaymentConceptId.");

            var concept = await _ctx.PaymentConcepts
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == dto.PaymentConceptId);

            if (concept == null)
                return BadRequest("El concepto no existe.");

            // recomendado en tu entidad: concept.RequiresSupplier
            // si todavía NO lo tenés, dejalo default false o manejalo por nombre.
            var requiresSupplier = concept.RequiresBusinessPartner;

            var hasApplies = dto.Applies != null && dto.Applies.Count > 0;
            var appliesSum = hasApplies ? dto.Applies.Sum(x => Math.Max(0m, x.Amount)) : 0m;

            // ✅ Reglas
            if (requiresSupplier)
            {
                // concepto Proveedor: supplier obligatorio
                if (dto.SupplierId == null)
                    return BadRequest("Este concepto requiere proveedor (SupplierId).");

                // puede ser con facturas o pago directo al proveedor
                if (hasApplies)
                {
                    if (appliesSum <= 0m) return BadRequest("Las aplicaciones deben sumar > 0.");
                }
                else
                {
                    // pago directo al proveedor sin facturas
                    if (dto.TotalAmount <= 0m)
                        return BadRequest("TotalAmount debe ser mayor a 0 para pagos sin facturas.");
                }
            }
            else
            {
                // conceptos no-proveedor (sueldos/IPS/impuestos/otro):
                // no deberían traer aplicaciones a facturas
                if (hasApplies)
                    return BadRequest("Este concepto no permite aplicar a facturas (Applies debe estar vacío).");

                if (dto.TotalAmount <= 0m)
                    return BadRequest("TotalAmount debe ser mayor a 0.");

                // proveedor opcional, pero si no hay supplier, debe haber payeeName
                if (dto.SupplierId == null && string.IsNullOrWhiteSpace(dto.PayeeName))
                    return BadRequest("Debe indicar SupplierId o PayeeName.");
            }

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                string payeeName = (dto.PayeeName ?? "").Trim();

                if (dto.SupplierId.HasValue)
                {
                    var sup = await _ctx.SociosNegocio
                        .AsNoTracking()
                        .FirstOrDefaultAsync(s => s.Id == dto.SupplierId.Value);

                    if (sup == null) return BadRequest("Proveedor no existe.");
                    payeeName = string.IsNullOrWhiteSpace(payeeName) ? sup.RazonSocial : payeeName;
                }

                var total = hasApplies ? appliesSum : dto.TotalAmount;

                var doc = new PaymentMade
                {
                    PaymentDate = dto.PaymentDate ?? DateTime.UtcNow,
                    SupplierId = dto.SupplierId,
                    PayeeName = payeeName,

                    // ✅ nuevo
                    PaymentConceptId = dto.PaymentConceptId,

                    Method = method,
                    Reference = dto.Reference?.Trim(),
                    Notes = dto.Notes?.Trim(),
                    TotalAmount = total,
                    Status = STATUS_VIGENTE,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = User.Identity?.Name ?? "system",
                };

                _ctx.PaymentsMade.Add(doc);
                await _ctx.SaveChangesAsync();

                if (hasApplies)
                {
                    foreach (var a in dto.Applies!)
                    {
                        if (a.Amount <= 0m) continue;

                        var inv = await _ctx.APInvoices.FirstOrDefaultAsync(x => x.Id == a.APInvoiceId);
                        if (inv == null) return BadRequest($"CxP no existe: {a.APInvoiceId}");

                        if (doc.SupplierId.HasValue && inv.SupplierId != doc.SupplierId.Value)
                            return BadRequest($"CxP {inv.Id} no pertenece al proveedor seleccionado.");

                        var st = (inv.Status ?? "OPEN").ToUpperInvariant();
                        if (st == "CANCELLED") return BadRequest($"CxP {inv.Id} está CANCELLED.");
                        if (st == "PAID") return BadRequest($"CxP {inv.Id} ya está PAID.");

                        if (a.Amount > inv.Balance)
                            return BadRequest($"Monto excede balance de CxP {inv.Id}. Balance: {inv.Balance:n0}");

                        var apply = new PaymentMadeApply
                        {
                            PaymentMadeId = doc.Id,
                            APInvoiceId = inv.Id,
                            Amount = a.Amount,
                            TargetInstallmentId = a.TargetInstallmentId,
                            ApplyExcessToNext = a.ApplyExcessToNext
                        };
                        _ctx.PaymentMadeApplies.Add(apply);

                        var apPay = new APInvoicePayment
                        {
                            APInvoiceId = inv.Id,
                            PaymentMadeId = doc.Id,
                            Amount = a.Amount,
                            PaymentDate = doc.PaymentDate,
                            Method = doc.Method,
                            Reference = doc.Reference,
                            Notes = doc.Notes,
                            IsCancelled = false,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = doc.CreatedBy,

                            TargetInstallmentId = a.TargetInstallmentId,
                            ApplyExcessToNext = a.ApplyExcessToNext
                        };

                        _ctx.APInvoicePayments.Add(apPay);

                        var paidSum = await _ctx.APInvoicePayments
                            .Where(p => p.APInvoiceId == inv.Id && !p.IsCancelled)
                            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                        RecalcInvoiceTotals(inv, paidSum);
                        inv.UpdatedAt = DateTime.UtcNow;

                        await _ctx.SaveChangesAsync();
                        await RecalculateInstallmentsFromPayments(inv.Id);
                        await _ctx.SaveChangesAsync();
                    }
                }

                await trx.CommitAsync();
                return Ok(new { ok = true, id = doc.Id, hasApplies });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/paymentsmade/5/cancel
        [RequirePermission(Perms.PaymentsMadeView)]
        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] CancelDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la cancelación.");

                var doc = await _ctx.PaymentsMade.FirstOrDefaultAsync(x => x.Id == id);
                if (doc == null) return NotFound("Pago no existe.");

                if ((doc.Status ?? STATUS_VIGENTE).ToUpperInvariant() == STATUS_ANULADO)
                    return Ok(new { ok = true, message = "Ya estaba anulado." });

                doc.Status = STATUS_ANULADO;
                doc.CancelledAt = DateTime.UtcNow;
                doc.CancelReason = dto?.Reason?.Trim();
                doc.CancelledBy = User.Identity?.Name ?? "system";

                var pays = await _ctx.APInvoicePayments
                    .Include(p => p.APInvoice)
                    .Where(p => p.PaymentMadeId == doc.Id && !p.IsCancelled)
                    .ToListAsync();

                foreach (var pay in pays)
                {
                    pay.IsCancelled = true;
                    pay.CancelledAt = DateTime.UtcNow;
                    pay.CancelReason = $"Anulado por Pago Realizado #{doc.Id}. {(dto?.Reason ?? "").Trim()}".Trim();
                    pay.CancelledBy = doc.CancelledBy;

                    var inv = pay.APInvoice!;
                    var paidSum = await _ctx.APInvoicePayments
                        .Where(p => p.APInvoiceId == inv.Id && !p.IsCancelled)
                        .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                    RecalcInvoiceTotals(inv, paidSum);
                    inv.UpdatedAt = DateTime.UtcNow;

                    await _ctx.SaveChangesAsync();
                    await RecalculateInstallmentsFromPayments(inv.Id);
                    await _ctx.SaveChangesAsync();
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // ======= helpers =======
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

        private async Task RecalculateInstallmentsFromPayments(int apInvoiceId)
        {
            var installments = await _ctx.APInvoiceInstallments
                .Where(x => x.APInvoiceId == apInvoiceId)
                .OrderBy(x => x.InstallmentNo)
                .ToListAsync();

            if (installments.Count == 0) return;

            foreach (var ins in installments)
            {
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

            foreach (var pay in pays)
            {
                var remaining = pay.Amount;
                if (remaining <= 0m) continue;

                int startIdx;

                if (pay.TargetInstallmentId.HasValue)
                {
                    startIdx = IndexOfInstallment(pay.TargetInstallmentId.Value);
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

                    ins.Status = (ins.Balance <= 0m) ? "PAID" : "OPEN";
                    ins.UpdatedAt = DateTime.UtcNow;

                    if (pay.TargetInstallmentId.HasValue && pay.ApplyExcessToNext == false)
                        break;
                }
            }
        }
    }
}
