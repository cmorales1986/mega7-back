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
    public class ARSalesReceiptsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        private readonly FiscalNumberService _fiscal;

        public ARSalesReceiptsController(Mega7DbContext ctx, PeriodService periods, FiscalNumberService fiscal)
        {
            _ctx = ctx;
            _periods = periods;
            _fiscal = fiscal;
        }

        // GET: api/arsalesreceipts?pendingDeposit=true&customerId=1&from=2026-01-01&to=2026-01-31
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] bool? pendingDeposit = null,
            [FromQuery] int? customerId = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null
        )
        {
            var q = _ctx.Set<ARSalesReceipt>()
                .AsNoTracking()
                .AsQueryable();

            if (pendingDeposit == true)
                q = q.Where(x => !x.IsDeposited);

            if (customerId.HasValue && customerId.Value > 0)
                q = q.Where(x => x.CustomerId == customerId.Value);

            if (from.HasValue)
                q = q.Where(x => x.ReceiptDate >= from.Value);

            if (to.HasValue)
                q = q.Where(x => x.ReceiptDate < to.Value.AddDays(1));

            var list = await q
                .OrderByDescending(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.ReceiptDate,
                    x.CustomerId,
                    x.CustomerName,
                    x.TotalReceived,
                    x.PaymentMethod,
                    x.PaymentReference,
                    x.FiscalFullNumber,
                    x.IsDeposited,
                    x.DepositedAt,
                    x.BankMovementId
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/arsalesreceipts/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var r = await _ctx.Set<ARSalesReceipt>()
                .AsNoTracking()
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (r == null) return NotFound();
            return Ok(r);
        }

        // POST: api/arsalesreceipts
        // ✅ crea recibo + aplica pagos a 1..N facturas
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ARSalesReceiptCreateDto dto)
        {
            if (dto == null) return BadRequest("Body requerido.");
            if (dto.CustomerId <= 0) return BadRequest("CustomerId requerido.");
            if (dto.Lines == null || dto.Lines.Count == 0) return BadRequest("Lines requerido (1..N).");
            if (dto.Lines.Any(l => l.ARInvoiceId <= 0)) return BadRequest("ARInvoiceId inválido en Lines.");
            if (dto.Lines.Any(l => l.AppliedAmount <= 0)) return BadRequest("AppliedAmount debe ser > 0.");

            var receiptDateTime = dto.ReceiptDate ?? DateTime.UtcNow;
            var receiptDate = receiptDateTime.Date;

            if (!await _periods.HasOpenPeriodForDate(receiptDate))
                return BadRequest("No existe un período ABIERTO para la fecha del cobro.");

            var method = (dto.PaymentMethod ?? "CASH").Trim().ToUpperInvariant();
            var allowed = new HashSet<string> { "CASH", "TRANSFER", "CHECK", "CARD", "OTHER" };
            if (!allowed.Contains(method)) method = "OTHER";

            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var invIds = dto.Lines.Select(x => x.ARInvoiceId).Distinct().ToList();

                var invoices = await _ctx.ARInvoices
                    .Include(i => i.Customer)
                    .Include(i => i.Installments)
                    .Where(i => invIds.Contains(i.Id))
                    .ToListAsync();

                if (invoices.Count != invIds.Count)
                    return BadRequest("Alguna ARInvoice no existe.");

                if (invoices.Any(i => i.CustomerId != dto.CustomerId))
                    return BadRequest("Todas las facturas del recibo deben ser del mismo cliente.");

                foreach (var inv in invoices)
                {
                    var st = (inv.Status ?? "OPEN").ToUpperInvariant();
                    if (st == "CANCELLED") return BadRequest($"Factura {inv.FiscalFullNumber ?? inv.DocNumber} está CANCELLED.");
                    if (st == "PAID") return BadRequest($"Factura {inv.FiscalFullNumber ?? inv.DocNumber} ya está PAID.");
                }

                var paidMap = await _ctx.ARInvoicePayments
                    .AsNoTracking()
                    .Where(p => invIds.Contains(p.ARInvoiceId) && !p.IsCancelled)
                    .GroupBy(p => p.ARInvoiceId)
                    .Select(g => new { ARInvoiceId = g.Key, Paid = g.Sum(x => (decimal?)x.Amount) ?? 0m })
                    .ToDictionaryAsync(x => x.ARInvoiceId, x => x.Paid);

                foreach (var line in dto.Lines)
                {
                    var inv = invoices.First(i => i.Id == line.ARInvoiceId);
                    var paidBefore = paidMap.TryGetValue(inv.Id, out var pb) ? pb : 0m;
                    var remaining = inv.Total - paidBefore;

                    if (remaining <= 0m) return BadRequest($"Factura {inv.FiscalFullNumber ?? inv.DocNumber} no tiene saldo.");
                    if (line.AppliedAmount > remaining)
                        return BadRequest($"Monto aplicado excede saldo en factura {inv.FiscalFullNumber ?? inv.DocNumber}. Saldo: {remaining:n0}");

                    if (line.TargetInstallmentId.HasValue)
                    {
                        var ok = inv.Installments.Any(x => x.Id == line.TargetInstallmentId.Value);
                        if (!ok) return BadRequest($"La cuota {line.TargetInstallmentId} no pertenece a la factura {inv.FiscalFullNumber ?? inv.DocNumber}.");
                    }
                }

                var totalReceived = dto.Lines.Sum(x => x.AppliedAmount);

                FiscalNumberReservation res =
                    dto.FiscalSeriesId.HasValue
                        ? await _fiscal.ReserveByIdAsync(dto.FiscalSeriesId.Value, receiptDate)
                        : await _fiscal.ReserveAsync("RECIBO", onDate: receiptDate);

                var firstInv = invoices.First();

                var receipt = new ARSalesReceipt
                {
                    ReceiptDate = receiptDateTime,

                    CustomerId = dto.CustomerId,
                    CustomerName = firstInv.CustomerName,
                    CustomerRuc = firstInv.Customer?.RUC,

                    PaymentMethod = method,
                    PaymentReference = dto.PaymentReference?.Trim(),
                    Notes = dto.Notes?.Trim(),

                    TotalReceived = totalReceived,

                    FiscalDocType = "RECIBO",
                    FiscalSeriesId = res.SeriesId,
                    FiscalTimbrado = res.Timbrado,
                    FiscalEstablishment = res.Establishment,
                    FiscalExpeditionPoint = res.ExpeditionPoint,
                    FiscalNumber = res.Number,
                    FiscalFullNumber = res.FullNumber,

                    CreatedAt = DateTime.UtcNow,

                    // ✅ depósito
                    IsDeposited = false,
                    DepositedAt = null,
                    DepositedByUserId = null,
                    BankMovementId = null
                };

                _ctx.Add(receipt);
                await _ctx.SaveChangesAsync(); // receipt.Id

                foreach (var line in dto.Lines)
                {
                    var inv = invoices.First(i => i.Id == line.ARInvoiceId);

                    _ctx.Add(new ARSalesReceiptLine
                    {
                        ARSalesReceiptId = receipt.Id,
                        ARInvoiceId = inv.Id,
                        AppliedAmount = line.AppliedAmount,
                        InvoiceDocNumber = inv.DocNumber,
                        InvoiceFiscalNumber = inv.FiscalFullNumber
                    });

                    _ctx.ARInvoicePayments.Add(new ARInvoicePayment
                    {
                        ARInvoiceId = inv.Id,
                        Amount = line.AppliedAmount,
                        PaymentDate = receiptDateTime,
                        Method = method,
                        Reference = dto.PaymentReference?.Trim(),
                        Notes = dto.Notes?.Trim(),
                        IsCancelled = false,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.Identity?.Name ?? "system",

                        TargetInstallmentId = line.TargetInstallmentId,
                        ApplyExcessToNext = line.ApplyExcessToNext,

                        ARSalesReceiptId = receipt.Id
                    });

                    var pb = paidMap.TryGetValue(inv.Id, out var oldPaid) ? oldPaid : 0m;
                    paidMap[inv.Id] = pb + line.AppliedAmount;
                }

                await _ctx.SaveChangesAsync();

                foreach (var inv in invoices)
                {
                    var paidSum = paidMap.TryGetValue(inv.Id, out var ps) ? ps : 0m;
                    RecalcInvoiceTotals(inv, paidSum);
                    inv.UpdatedAt = DateTime.UtcNow;

                    await RecalculateInstallmentsFromPayments(inv.Id);
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                var alwaysPrint = invoices.Any(i => (i.PaymentType ?? "CASH").ToUpperInvariant() == "CREDIT");

                return Ok(new
                {
                    ok = true,
                    receiptId = receipt.Id,
                    receiptFiscalNumber = receipt.FiscalFullNumber,
                    totalReceived = receipt.TotalReceived,
                    alwaysPrint
                });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("undeposited")]
        public async Task<IActionResult> GetUndeposited([FromQuery] int? customerId = null)
        {
            var q = _ctx.Set<ARSalesReceipt>()
                .AsNoTracking()
                .Include(x => x.Lines)
                .Where(x => !x.IsDeposited);

            if (customerId.HasValue)
                q = q.Where(x => x.CustomerId == customerId.Value);

            var list = await q
                .OrderByDescending(x => x.ReceiptDate)
                .ThenByDescending(x => x.Id)
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/arsalesreceipts/deposit
        [HttpPost("deposit")]
        public async Task<ActionResult<ReceiptDepositResultDto>> Deposit([FromBody] ReceiptDepositRequestDto dto)
        {
            if (dto == null) return BadRequest("Body requerido.");
            if (dto.BankAccountId <= 0) return BadRequest("BankAccountId inválido.");
            if (dto.ReceiptIds == null || dto.ReceiptIds.Count == 0) return BadRequest("Seleccioná al menos un recibo.");

            var date = dto.Date == default ? DateTime.UtcNow : dto.Date;

            // ✅ debe haber período abierto (misma lógica que bancos)
            if (!await _periods.HasOpenPeriodForDate(date))
                return BadRequest("No existe un período ABIERTO para la fecha del depósito.");

            // cuenta destino
            var acc = await _ctx.BankAccounts
                .Include(a => a.Bank)
                .FirstOrDefaultAsync(a => a.Id == dto.BankAccountId);

            if (acc == null) return BadRequest("La cuenta bancaria no existe.");
            if (!acc.IsActive) return BadRequest("La cuenta bancaria está inactiva.");

            // traer recibos
            var receipts = await _ctx.Set<ARSalesReceipt>()
                .Include(r => r.Lines)
                .Where(r => dto.ReceiptIds.Contains(r.Id))
                .ToListAsync();

            if (receipts.Count != dto.ReceiptIds.Count)
                return BadRequest("Uno o más recibos no existen.");

            if (receipts.Any(r => r.IsDeposited))
                return BadRequest("Hay recibos seleccionados que ya están depositados.");

            var total = receipts.Sum(r => r.TotalReceived);

            if (total <= 0)
                return BadRequest("El total a depositar debe ser mayor a 0.");

            // ✅ Crear movimiento bancario IN (1 solo por lote)
            var mov = new BankMovement
            {
                Date = date,
                Type = "IN",
                AccountId = acc.Id,
                Amount = total,
                Currency = acc.Currency,
                Reference = (dto.Reference ?? "").Trim(),
                Description = string.IsNullOrWhiteSpace(dto.Description)
                    ? $"Depósito de recaudaciones ({receipts.Count} recibos)"
                    : dto.Description.Trim(),
            };

            _ctx.BankMovements.Add(mov);
            await _ctx.SaveChangesAsync(); // para obtener mov.Id

            // ✅ Marcar recibos como depositados y linkear movimiento
            foreach (var r in receipts)
            {
                r.IsDeposited = true;
                r.DepositedAt = DateTime.UtcNow;
                r.BankMovementId = mov.Id;
            }

            await _ctx.SaveChangesAsync();

            return Ok(new ReceiptDepositResultDto
            {
                BankMovementId = mov.Id,
                Amount = total,
                DepositedCount = receipts.Count
            });
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

                    if (p.TargetInstallmentId.HasValue && p.ApplyExcessToNext == false)
                        break;
                }
            }
        }
    }
}
