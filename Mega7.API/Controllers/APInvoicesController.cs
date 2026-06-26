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
    public class APInvoicesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        private readonly AccountingService _accounting;

        public APInvoicesController(Mega7DbContext ctx, PeriodService periods, AccountingService accounting)
        {
            _ctx = ctx;
            _periods = periods;
            _accounting = accounting;
        }

        // GET: api/apinvoices?status=OPEN&includeCancelled=false&supplierId=2&onlyWithBalance=true
        [RequirePermission(Perms.APInvoicesView)]
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? status = null,
            [FromQuery] bool includeCancelled = false,
            [FromQuery] int? supplierId = null,
            [FromQuery] bool onlyWithBalance = false)
        {
            var q = _ctx.APInvoices
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

            if (supplierId.HasValue && supplierId.Value > 0)
                q = q.Where(x => x.SupplierId == supplierId.Value);

            if (onlyWithBalance)
                q = q.Where(x => x.Balance > 0);

            var today = DateTime.UtcNow.Date;

            var list = await q.Select(x => new
            {
                x.Id,
                x.PurchaseReceiptId,
                x.SupplierId,
                x.SupplierName,
                x.InvoiceNumber,
                x.InvoiceDate,
                x.DueDate,
                x.Total,
                x.Balance,
                x.Status,
                x.CreatedAt,
                x.UpdatedAt,
                SourceType = x.SourceType,
                IsCancelled = (x.Status ?? "OPEN").ToUpper() == "CANCELLED",
                IsPaid = (x.Status ?? "OPEN").ToUpper() == "PAID",
                IsPartial = (x.Status ?? "OPEN").ToUpper() == "PARTIAL",
                IsOpen = (x.Status ?? "OPEN").ToUpper() == "OPEN",
                IsOverdue = x.DueDate.HasValue
                    && x.DueDate.Value.Date < today
                    && (x.Status ?? "OPEN").ToUpper() != "PAID"
                    && (x.Status ?? "OPEN").ToUpper() != "CANCELLED",

                x.CancelledAt,
                x.CancelReason
            }).ToListAsync();

            return Ok(list);
        }

        // GET: api/apinvoices/{id}
        [RequirePermission(Perms.APInvoicesView)]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var x = await _ctx.APInvoices
                .AsNoTracking()
                .Where(a => a.Id == id)
                .Select(a => new
                {
                    a.Id,
                    a.PurchaseReceiptId,
                    a.SupplierId,
                    a.SupplierName,
                    a.InvoiceNumber,
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

        // GET: api/apinvoices/{id}/lines
        // GET: api/apinvoices/{id}/lines
        [RequirePermission(Perms.APInvoicesView)]
        [HttpGet("{id:int}/lines")]
        public async Task<IActionResult> GetLines(int id)
        {
            // 1) Buscar CxP (header) para saber de dónde salen las líneas
            var ap = await _ctx.APInvoices
                .AsNoTracking()
                .Select(x => new
                {
                    x.Id,
                    x.PurchaseReceiptId,
                    x.SourceType
                })
                .FirstOrDefaultAsync(x => x.Id == id);

            if (ap == null) return NotFound("CxP no existe.");

            // 2) GOODS: traer líneas desde PurchaseReceipt
            if (ap.PurchaseReceiptId.HasValue && ap.PurchaseReceiptId.Value > 0)
            {
                var receiptId = ap.PurchaseReceiptId.Value;

                var receiptLines = await _ctx.PurchaseReceiptLines
                    .AsNoTracking()
                    .Where(l => l.PurchaseReceiptId == receiptId)
                    .OrderBy(l => l.Id)
                    .Select(l => new
                    {
                        Source = "GOODS",
                        // Para UI genérica:
                        Description = (l.ProductCode + " - " + l.ProductName).Trim(),
                        Quantity = l.Quantity,
                        UnitPrice = l.UnitPrice,
                        LineTotal = l.LineTotal,

                        // Extra útil si querés mostrar más:
                        l.ProductId,
                        l.ProductCode,
                        l.ProductName,
                        l.BatchNumber,
                        l.SerialNumbers
                    })
                    .ToListAsync();

                return Ok(receiptLines);
            }

            // 3) SERVICE (o sin receipt): traer líneas desde APInvoiceLines
            var serviceLines = await _ctx.APInvoiceLines
                .AsNoTracking()
                .Where(l => l.APInvoiceId == id)
                .OrderBy(l => l.Id)
                .Select(l => new
                {
                    Source = "SERVICE",
                    l.Description,
                    Quantity = l.Quantity,
                    UnitPrice = l.UnitPrice,
                    LineTotal = l.LineTotal
                })
                .ToListAsync();

            return Ok(serviceLines);
        }


        // GET: api/apinvoices/by-receipt/123
        [RequirePermission(Perms.APInvoicesView)]
        [HttpGet("by-receipt/{receiptId:int}")]
        public async Task<IActionResult> GetByReceipt(int receiptId)
        {
            var x = await _ctx.APInvoices
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.PurchaseReceiptId == receiptId);

            if (x == null) return NotFound();
            return Ok(x);
        }

        // GET: api/apinvoices/{id}/installments
        [RequirePermission(Perms.APInvoicesView)]
        [HttpGet("{id:int}/installments")]
        public async Task<IActionResult> GetInstallments(int id)
        {
            var exists = await _ctx.APInvoices.AsNoTracking().AnyAsync(x => x.Id == id);
            if (!exists) return NotFound("CxP no existe.");

            var list = await _ctx.APInvoiceInstallments
                .AsNoTracking()
                .Where(x => x.APInvoiceId == id)
                .OrderBy(x => x.InstallmentNo)
                .Select(x => new
                {
                    x.Id,
                    x.APInvoiceId,
                    x.InstallmentNo,
                    x.DueDate,
                    x.Amount,
                    x.PaidAmount,
                    x.Balance,
                    x.Status,
                    x.CreatedAt,
                    x.UpdatedAt
                })
                .ToListAsync();

            return Ok(list);
        }

        // POST: api/apinvoices/{id}/installments/generate?count=3&creditDays=0
        // Genera cuotas "parejas" (con ajuste en la última) y setea DueDate del header como última cuota.
        [RequirePermission(Perms.APInvoicesCreate)]
        [HttpPost("{id:int}/installments/generate")]
        public async Task<IActionResult> GenerateInstallments(
            int id,
            [FromQuery] int count = 1,
            [FromQuery] int creditDays = 0)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                if (count <= 0) return BadRequest("count debe ser >= 1.");
                if (count > 60) return BadRequest("count demasiado grande.");
                if (creditDays < 0) creditDays = 0;

                var ap = await _ctx.APInvoices.FirstOrDefaultAsync(x => x.Id == id);
                if (ap == null) return NotFound("CxP no existe.");

                // ✅ primero null-check, luego período
                if (!await _periods.HasOpenPeriodForDate(ap.InvoiceDate))
                    return BadRequest("No existe un período ABIERTO para la fecha de la factura (CxP).");

                var st = (ap.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return BadRequest("No se puede: CxP cancelada.");
                if (st == "PAID") return BadRequest("No se puede: CxP pagada.");
                if (st == "PARTIAL") return BadRequest("No se puede regenerar cuotas: CxP parcial (tiene pagos).");

                // ✅ si hay pagos no cancelados, no permitir
                var paidSum = await _ctx.APInvoicePayments
                    .Where(p => p.APInvoiceId == ap.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                if (paidSum > 0m)
                    return BadRequest("No se puede generar cuotas: existen pagos registrados.");

                // borrar cuotas previas
                var prev = await _ctx.APInvoiceInstallments
                    .Where(x => x.APInvoiceId == ap.Id)
                    .ToListAsync();

                if (prev.Count > 0)
                    _ctx.APInvoiceInstallments.RemoveRange(prev);

                // primer vencimiento = InvoiceDate + creditDays
                var firstDue = ap.InvoiceDate.Date.AddDays(creditDays);

                // ✅ generar cuotas “parejas” (ajuste última)
                var total = ap.Total;
                var baseAmount = Math.Floor((double)(total / count) * 100) / 100; // trunc a 2 dec
                var baseDec = (decimal)baseAmount;

                decimal acc = 0m;

                for (var i = 1; i <= count; i++)
                {
                    var amount = (i == count) ? (total - acc) : baseDec;
                    acc += amount;

                    // mensual calendario
                    var due = firstDue.AddMonths(i - 1);

                    _ctx.APInvoiceInstallments.Add(new APInvoiceInstallment
                    {
                        APInvoiceId = ap.Id,
                        InstallmentNo = i,
                        DueDate = due,
                        Amount = amount,
                        PaidAmount = 0m,
                        Balance = amount,
                        Status = "OPEN",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                // header
                ap.DueDate = firstDue.AddMonths(count - 1);
                ap.Balance = ap.Total;
                ap.Status = "OPEN";
                ap.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ap.Id, ap.DueDate, installments = count });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/apinvoices/{id}/cancel   ✅ (ANTES estaba mal: era ARInvoices adentro de APInvoicesController)
        [RequirePermission(Perms.APInvoicesCancel)]
        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] APInvoiceCancelDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la operación.");

                var ap = await _ctx.APInvoices.FirstOrDefaultAsync(x => x.Id == id);
                if (ap == null) return NotFound("CxP no existe.");

                var st = (ap.Status ?? "OPEN").ToUpperInvariant();

                if (st == "CANCELLED")
                    return Ok(new { ok = true, ap.Id, ap.Status });

                if (st == "PAID")
                    return BadRequest("No se puede cancelar: la CxP está pagada.");

                var paidSum = await _ctx.APInvoicePayments
                    .Where(p => p.APInvoiceId == ap.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                if (paidSum > 0m)
                    return BadRequest("No se puede cancelar: la CxP tiene pagos registrados.");

                ap.Status = "CANCELLED";
                ap.CancelledAt = DateTime.UtcNow;
                ap.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason)
                    ? "Cancelado manualmente."
                    : dto!.Reason!.Trim();

                ap.Balance = 0m;
                ap.UpdatedAt = DateTime.UtcNow;

                // (opcional) cancelar cuotas
                var ins = await _ctx.APInvoiceInstallments.Where(x => x.APInvoiceId == ap.Id).ToListAsync();
                foreach (var i in ins)
                {
                    i.Status = "CANCELLED";
                    i.Balance = 0m;
                    i.UpdatedAt = DateTime.UtcNow;
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ap.Id, ap.Status, ap.Balance, ap.CancelledAt, ap.CancelReason });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/apinvoices/{id}/reopen  ✅ (ANTES estaba mal: era ARInvoices adentro de APInvoicesController)
        [RequirePermission(Perms.APInvoicesCreate)]
        [HttpPost("{id:int}/reopen")]
        public async Task<IActionResult> Reopen(int id, [FromBody] APInvoiceReopenDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la operación.");

                var ap = await _ctx.APInvoices.FirstOrDefaultAsync(x => x.Id == id);
                if (ap == null) return NotFound("CxP no existe.");

                var st = (ap.Status ?? "OPEN").ToUpperInvariant();

                if (st != "CANCELLED")
                    return BadRequest("Solo se puede reabrir una CxP en estado CANCELLED.");

                var paidSum = await _ctx.APInvoicePayments
                    .Where(p => p.APInvoiceId == ap.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                if (paidSum > 0m)
                    return BadRequest("No se puede reabrir: la CxP tiene pagos registrados.");

                ap.Status = "OPEN";
                ap.CancelledAt = null;
                ap.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason) ? null : dto!.Reason!.Trim();

                // reponer saldo completo (si no querés, podés recalcular por pagos; pero acá no hay pagos)
                ap.Balance = ap.Total;
                ap.UpdatedAt = DateTime.UtcNow;

                // (opcional) reabrir cuotas: si existen, poner OPEN y recalcular balances como amount
                var ins = await _ctx.APInvoiceInstallments.Where(x => x.APInvoiceId == ap.Id).ToListAsync();
                foreach (var i in ins)
                {
                    i.Status = "OPEN";
                    i.PaidAmount = 0m;
                    i.Balance = i.Amount;
                    i.UpdatedAt = DateTime.UtcNow;
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ap.Id, ap.Status, ap.Balance });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/apinvoices   ── Factura Proveedor unificada (ITEM + SERVICE)
        [RequirePermission(Perms.APInvoicesCreate)]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] APInvoiceUnifiedCreateDto dto)
        {
            if (dto == null) return BadRequest("Payload inválido.");
            if (dto.SupplierId <= 0) return BadRequest("SupplierId inválido.");
            if (string.IsNullOrWhiteSpace(dto.InvoiceNumber)) return BadRequest("InvoiceNumber es requerido.");
            if (dto.Lines == null || dto.Lines.Count == 0) return BadRequest("La factura debe tener al menos una línea.");

            var invDate = dto.InvoiceDate == default ? DateTime.UtcNow.Date : dto.InvoiceDate.Date;

            if (!await _periods.HasOpenPeriodForDate(invDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la factura.");

            var sup = await _ctx.SociosNegocio.AsNoTracking().FirstOrDefaultAsync(s => s.Id == dto.SupplierId);
            if (sup == null) return BadRequest("Proveedor no existe.");

            var invNo = dto.InvoiceNumber.Trim();
            var dupExists = await _ctx.APInvoices.AsNoTracking()
                .AnyAsync(x => x.SupplierId == dto.SupplierId && x.InvoiceNumber == invNo && x.Status != "CANCELLED");
            if (dupExists) return BadRequest("Ya existe una factura activa con ese número para este proveedor.");

            var itemLines = dto.Lines.Where(l => l.LineType?.ToUpperInvariant() == "ITEM").ToList();
            var hasItemLines = itemLines.Any();

            if (hasItemLines && !dto.WarehouseId.HasValue && itemLines.Any(l => !l.WarehouseId.HasValue))
                return BadRequest("Debe especificar un depósito (en el header o en cada línea ITEM).");

            // Cargar productos para líneas ITEM
            var productIds = itemLines.Where(l => l.ProductId.HasValue).Select(l => l.ProductId!.Value).Distinct().ToList();
            var products = productIds.Count > 0
                ? await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync()
                : new List<Mega7.SHARED.Entities.Product>();

            var taxIds = dto.Lines.Where(l => l.TaxId.HasValue).Select(l => l.TaxId!.Value).Distinct().ToList();
            var taxes  = taxIds.Count > 0
                ? await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync()
                : new List<Mega7.SHARED.Entities.Tax>();

            // Validar líneas ITEM
            foreach (var l in itemLines)
            {
                if (!l.ProductId.HasValue || l.ProductId <= 0)
                    return BadRequest("Línea ITEM sin ProductId.");
                if (l.Quantity <= 0)
                    return BadRequest("Cantidad debe ser > 0.");
                var prod = products.FirstOrDefault(p => p.Id == l.ProductId);
                if (prod == null) return BadRequest($"Producto no encontrado (ID {l.ProductId}).");
                if (prod.IsBatchManaged && string.IsNullOrWhiteSpace(l.BatchNumber))
                    return BadRequest($"El producto '{prod.Name}' requiere número de lote.");
                if (prod.IsSerialManaged && string.IsNullOrWhiteSpace(l.SerialNumbers))
                    return BadRequest($"El producto '{prod.Name}' requiere números de serie.");
            }

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                // ── Construir líneas ────────────────────────────────────────────────
                var builtLines = new List<APInvoiceLine>();
                decimal grandTotal = 0m;

                foreach (var l in dto.Lines)
                {
                    var isItem  = l.LineType?.ToUpperInvariant() == "ITEM";
                    var tax     = l.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == l.TaxId.Value) : null;
                    var disc    = Math.Clamp(l.DiscountPercent, 0m, 100m);
                    var sub     = Math.Round(l.Quantity * l.UnitPrice * ((100m - disc) / 100m), 2);
                    var taxAmt  = Math.Round(sub * ((tax?.Rate ?? 0m) / 100m), 2);
                    var total   = sub + taxAmt;
                    grandTotal += total;

                    var prod    = isItem && l.ProductId.HasValue
                        ? products.FirstOrDefault(p => p.Id == l.ProductId.Value)
                        : null;

                    builtLines.Add(new APInvoiceLine
                    {
                        LineType        = isItem ? "ITEM" : "SERVICE",
                        Description     = isItem
                            ? (prod != null ? $"{prod.Code} – {prod.Name}" : "")
                            : (l.Description?.Trim() ?? ""),
                        ProductId       = isItem ? l.ProductId : null,
                        ProductCode     = prod?.Code,
                        ProductName     = prod?.Name,
                        WarehouseId     = isItem ? (l.WarehouseId ?? dto.WarehouseId) : null,
                        Quantity        = l.Quantity,
                        UnitPrice       = l.UnitPrice,
                        DiscountPercent = disc,
                        TaxId           = l.TaxId,
                        TaxRate         = tax?.Rate ?? 0m,
                        SubTotal        = sub,
                        TaxAmount       = taxAmt,
                        LineTotal       = total,
                        BatchNumber     = isItem ? l.BatchNumber : null,
                        ExpirationDate  = isItem ? l.ExpirationDate : null,
                        SerialNumbers   = isItem ? l.SerialNumbers : null,
                        CreatedAt       = DateTime.UtcNow,
                    });
                }

                if (grandTotal <= 0m) return BadRequest("El total de la factura debe ser mayor a 0.");

                // ── Crear APInvoice ─────────────────────────────────────────────────
                var ap = new APInvoice
                {
                    PurchaseReceiptId = dto.PurchaseReceiptId,
                    PurchaseOrderId   = dto.PurchaseOrderId,
                    WarehouseId       = dto.WarehouseId,
                    SourceType        = hasItemLines ? "DIRECT" : "SERVICE",
                    SupplierId        = sup.Id,
                    SocioNegocioId    = sup.Id,
                    SupplierName      = sup.RazonSocial,
                    InvoiceNumber     = invNo,
                    InvoiceDate       = invDate,
                    DueDate           = dto.DueDate?.Date,
                    Total             = grandTotal,
                    Balance           = grandTotal,
                    Status            = "OPEN",
                    Notes             = dto.Notes?.Trim() ?? string.Empty,
                    CreatedAt         = DateTime.UtcNow,
                    UpdatedAt         = DateTime.UtcNow,
                };

                _ctx.APInvoices.Add(ap);
                await _ctx.SaveChangesAsync(); // ap.Id

                foreach (var ln in builtLines)
                {
                    ln.APInvoiceId = ap.Id;
                    _ctx.APInvoiceLines.Add(ln);
                }
                await _ctx.SaveChangesAsync();

                // ── Stock update para líneas ITEM ───────────────────────────────────
                if (hasItemLines)
                {
                    var stockEntry = new StockEntry
                    {
                        DocumentType   = "AP_INVOICE",
                        DocumentNumber = ap.InvoiceNumber,
                        DocumentRef    = $"FAC:{ap.InvoiceNumber}",
                        EntryDate      = invDate,
                        WarehouseId    = dto.WarehouseId ?? itemLines.First().WarehouseId ?? 0,
                        SupplierId     = ap.SupplierId,
                        SupplierName   = ap.SupplierName,
                        Notes          = ap.Notes,
                        EntryMode      = "ADD",
                        CreatedBy      = User.Identity?.Name ?? "system",
                        Lines = builtLines
                            .Where(l => l.LineType == "ITEM")
                            .Select(l => new StockEntryLine
                            {
                                ProductId      = l.ProductId!.Value,
                                WarehouseId    = l.WarehouseId ?? dto.WarehouseId ?? 0,
                                Quantity       = l.Quantity,
                                UnitCost       = l.SubTotal > 0 && l.Quantity > 0 ? l.SubTotal / l.Quantity : l.UnitPrice,
                                TaxRate        = l.TaxRate,
                                BatchNumber    = l.BatchNumber,
                                ExpirationDate = l.ExpirationDate,
                                SerialNumbers  = l.SerialNumbers,
                            }).ToList()
                    };

                    await ApplyStockEntryAP(stockEntry);
                }

                try { await _accounting.PostAPInvoiceAsync(ap.Id); } catch { }

                await trx.CommitAsync();
                return Ok(new { ok = true, id = ap.Id, total = ap.Total, ap.SourceType });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error al crear factura: {ex.Message}");
            }
        }

        // ── Helpers de stock (replicados para mantener APInvoicesController autónomo) ──

        private async Task ApplyStockEntryAP(StockEntry entry)
        {
            if (entry.Lines == null || entry.Lines.Count == 0)
                throw new Exception("No se puede crear un ingreso sin líneas.");

            _ctx.StockEntries.Add(entry);
            await _ctx.SaveChangesAsync();

            static decimal WeightedAvg(decimal oldQty, decimal oldCost, decimal inQty, decimal inCost)
            {
                var newQty = oldQty + inQty;
                if (newQty <= 0) return 0m;
                return ((oldQty * oldCost) + (inQty * inCost)) / newQty;
            }

            foreach (var line in entry.Lines)
            {
                line.StockEntryId = entry.Id;
                var product = await _ctx.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId);
                if (product == null) throw new Exception($"Producto no encontrado (ID {line.ProductId})");

                var stock = await _ctx.Stocks
                    .FirstOrDefaultAsync(s => s.ProductId == line.ProductId && s.WarehouseId == line.WarehouseId);
                if (stock == null)
                {
                    stock = new Stock { ProductId = line.ProductId, WarehouseId = line.WarehouseId, Quantity = 0, AvgCost = 0 };
                    _ctx.Stocks.Add(stock);
                }

                var oldQty = stock.Quantity;
                var oldAvg = stock.AvgCost;
                stock.Quantity += line.Quantity;

                if (!product.IsBatchManaged && !product.IsSerialManaged)
                {
                    stock.AvgCost = WeightedAvg(oldQty, oldAvg, line.Quantity, line.UnitCost);
                    if (stock.Quantity <= 0) stock.AvgCost = 0m;
                }

                if (product.IsBatchManaged)
                {
                    if (string.IsNullOrWhiteSpace(line.BatchNumber))
                        throw new Exception("El producto es loteable. Debe especificar BatchNumber.");
                    var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                        b.ProductId == line.ProductId && b.WarehouseId == line.WarehouseId && b.BatchNumber == line.BatchNumber);
                    if (batch == null)
                    {
                        batch = new Batch { ProductId = line.ProductId, WarehouseId = line.WarehouseId, BatchNumber = line.BatchNumber!, ExpirationDate = line.ExpirationDate, Quantity = 0, UnitCost = line.UnitCost };
                        _ctx.Batches.Add(batch);
                    }
                    else
                    {
                        batch.UnitCost = WeightedAvg(batch.Quantity, batch.UnitCost, line.Quantity, line.UnitCost);
                    }
                    batch.Quantity += line.Quantity;
                    batch.UpdatedAt = DateTime.UtcNow;
                }

                if (product.IsSerialManaged)
                {
                    if (string.IsNullOrWhiteSpace(line.SerialNumbers))
                        throw new Exception("Debe enviar SerialNumbers para productos serializables.");
                    var serialList = line.SerialNumbers!.Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
                    foreach (var sn in serialList)
                    {
                        if (await _ctx.Serials.AnyAsync(s => s.ProductId == product.Id && s.WarehouseId == line.WarehouseId && s.SerialNumber == sn))
                            throw new Exception($"El serial {sn} ya existe para este producto/depósito.");
                        _ctx.Serials.Add(new Serial { ProductId = product.Id, WarehouseId = line.WarehouseId, SerialNumber = sn, IsActive = true, UnitCost = line.UnitCost, CreatedAt = DateTime.UtcNow });
                    }
                }
            }
            await _ctx.SaveChangesAsync();
        }

        // POST: api/apinvoices/service
        // POST: api/apinvoices/service
        [RequirePermission(Perms.APInvoicesCreate)]
        [HttpPost("service")]
        public async Task<IActionResult> CreateServiceInvoice([FromBody] APServiceInvoiceCreateDto dto)
        {
            if (dto == null) return BadRequest("Payload inválido.");
            if (dto.SupplierId <= 0) return BadRequest("SupplierId inválido.");
            if (string.IsNullOrWhiteSpace(dto.InvoiceNumber)) return BadRequest("InvoiceNumber es requerido.");

            var invDate = dto.InvoiceDate.Date;

            if (!await _periods.HasOpenPeriodForDate(invDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la factura.");

            var sup = await _ctx.SociosNegocio
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == dto.SupplierId);

            if (sup == null) return BadRequest("Proveedor no existe.");

            var invNo = dto.InvoiceNumber.Trim();

            var exists = await _ctx.APInvoices
                .AsNoTracking()
                .AnyAsync(x => x.SupplierId == dto.SupplierId && (x.InvoiceNumber ?? "") == invNo);

            if (exists)
                return BadRequest("Ya existe una CxP con ese número de factura para este proveedor.");

            // ✅ Tomamos SOLO líneas válidas (evita total 0 por líneas incompletas)
            //    (si tu DTO de línea se llama distinto, cambiá el tipo de la lista o usá `new()`)
            var validLines = (dto.Lines ?? new List<APServiceInvoiceLineDto>())
                .Select(l => new
                {
                    Desc = (l.Description ?? "").Trim(),
                    Qty = l.Quantity,
                    Unit = l.UnitPrice
                })
                .Where(x =>
                    !string.IsNullOrWhiteSpace(x.Desc) &&
                    x.Qty > 0m &&
                    x.Unit > 0m
                )
                .ToList();

            var hasLines = validLines.Count > 0;

            decimal total;

            if (hasLines)
            {
                total = 0m;
                foreach (var l in validLines)
                    total += Math.Round(l.Qty * l.Unit, 2);

                if (total <= 0m)
                    return BadRequest("El total calculado por líneas debe ser mayor a 0.");
            }
            else
            {
                total = dto.Total;
                if (total <= 0m)
                    return BadRequest("Total debe ser mayor a 0 (si no hay líneas válidas).");
            }

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                var ap = new APInvoice
                {
                    PurchaseReceiptId = null,     // ✅ service: sin stock
                    SourceType = "SERVICE",       // ✅

                    SupplierId = dto.SupplierId,
                    SupplierName = sup.RazonSocial,

                    InvoiceNumber = invNo,
                    InvoiceDate = invDate,
                    DueDate = dto.DueDate?.Date,

                    Total = total,
                    Balance = total,
                    Status = "OPEN",

                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,

                    // ⚠️ Si APInvoice no tiene Notes, borrá esta línea:
                    Notes = dto.Notes?.Trim()
                };

                _ctx.APInvoices.Add(ap);
                await _ctx.SaveChangesAsync();

                // ✅ Guardar líneas (USAR validLines, no dto.Lines)
                if (hasLines)
                {
                    foreach (var l in validLines)
                    {
                        var lineTotal = Math.Round(l.Qty * l.Unit, 2);

                        _ctx.APInvoiceLines.Add(new APInvoiceLine
                        {
                            APInvoiceId = ap.Id,
                            Description = l.Desc,
                            Quantity = l.Qty,
                            UnitPrice = l.Unit,
                            LineTotal = lineTotal,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    await _ctx.SaveChangesAsync();
                }

                try { await _accounting.PostAPInvoiceAsync(ap.Id); } catch { }

                await trx.CommitAsync();
                return Ok(new { ok = true, id = ap.Id, total = ap.Total, hasLines });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

    }
}
