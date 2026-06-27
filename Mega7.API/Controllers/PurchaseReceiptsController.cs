using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using System.Globalization;
using Microsoft.Extensions.Logging;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PurchaseReceiptsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        private readonly ILogger<PurchaseReceiptsController> _logger;
        private readonly AccountingService _accounting;

        public PurchaseReceiptsController(Mega7DbContext ctx, PeriodService periods, ILogger<PurchaseReceiptsController> logger, AccountingService accounting)
        {
            _ctx = ctx;
            _periods = periods;
            _logger = logger;
            _accounting = accounting;
        }

        [RequirePermission(Perms.PurchaseReceiptsView)]
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool? notInvoiced = null, [FromQuery] bool? notCancelled = null)
        {
            var q = _ctx.PurchaseReceipts
                .AsNoTracking()
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .Include(x => x.PurchaseOrder)
                .Include(x => x.Documents)
                .OrderByDescending(x => x.Id)
                .AsQueryable();

            if (notInvoiced == true)
                q = q.Where(x => !x.IsInvoiced);

            if (notCancelled == true)
                q = q.Where(x => !x.IsCancelled && (x.Status ?? "").ToUpper() != "CANCELLED");

            var list = await q.Select(x => new
                {
                    x.Id,
                    x.DocNumber,
                    x.ReceiptDate,
                    x.SupplierId,
                    x.SupplierName,
                    Warehouse = x.Warehouse == null ? null : new { x.Warehouse.Id, x.Warehouse.Name },
                    x.Total,

                    x.Status,
                    x.IsCancelled,
                    x.CancelledAt,
                    x.CancelReason,
                    x.CancelledBy,

                    // ✅ NUEVO (FASE 1)
                    x.IsInvoiced,
                    x.InvoicedAt,
                    x.InvoiceNumber,
                    x.InvoiceDate,
                    x.InvoiceDueDate,
                    x.InvoiceTotal,
                    x.InvoiceIsCredit,
                    x.InvoiceCreditTermId,
                    x.InvoiceInstallments,

                    Documents = x.Documents.Select(d => new
                    {
                        d.Type,
                        d.Number,
                        d.Date
                    }).ToList()
                })
                .ToListAsync();

            return Ok(list);
        }


        [RequirePermission(Perms.PurchaseReceiptsView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var doc = await _ctx.PurchaseReceipts
                .AsNoTracking()
                .Where(x => x.Id == id)
                .Select(x => new
                {
                    x.Id,
                    x.DocNumber,
                    x.ReceiptDate,
                    x.SupplierId,
                    SupplierName = x.Supplier != null ? x.Supplier.RazonSocial : "",
                    x.WarehouseId,
                    Warehouse = x.Warehouse == null ? null : new
                    {
                        x.Warehouse.Id,
                        x.Warehouse.Name
                    },
                    x.PurchaseOrderId,
                    x.Comments,
                    x.SubTotal,
                    x.TaxTotal,
                    x.Total,
                    x.IsCancelled,

                    Documents = x.Documents.Select(d => new
                    {
                        d.Id,
                        d.Type,
                        d.Number
                    }).ToList(),

                    Lines = x.Lines.Select(l => new
                    {
                        l.Id,
                        l.ProductId,
                        ProductName = l.Product != null ? l.Product.Name : "",
                        l.Quantity,
                        l.UnitPrice,
                        l.LineTotal,
                        l.BatchNumber,
                        l.SerialNumbers,
                        l.TaxId,
                        TaxName = l.Tax != null ? l.Tax.Name : ""
                    }).ToList(),

                    // ✅ CxP resumido (si existe)
                    ApInvoice = _ctx.APInvoices
                        .Where(i => i.PurchaseReceiptId == x.Id)
                        .Select(i => new
                        {
                            i.Id,
                            i.Status,
                            i.Total,
                            i.PaidAt,
                            i.Balance
                        })
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (doc == null) return NotFound();
            return Ok(doc);
        }


        // POST: api/purchasereceipts
        [RequirePermission(Perms.PurchaseReceiptsCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(PurchaseReceiptCreateDto dto)
        {
            var receiptDate = dto.ReceiptDate == default ? DateTime.UtcNow : dto.ReceiptDate;
            if (!await _periods.HasOpenPeriodForDate(receiptDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la recepción.");

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest("No se puede crear una recepción sin líneas.");

            using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                // 1) Traer OC con líneas
                var po = await _ctx.PurchaseOrders
                    .Include(x => x.Lines)
                    .FirstOrDefaultAsync(x => x.Id == dto.PurchaseOrderId);

                if (po == null) return BadRequest("Orden de compra no existe.");
                if (po.Status != "OPEN") return BadRequest("La OC debe estar en estado OPEN para recepcionar.");

                // 2) Validaciones de cantidades
                if (dto.Lines.Any(l => l.Quantity <= 0))
                    return BadRequest("Cantidad recibida debe ser > 0.");

                // Map PO lines
                var poLineIds = po.Lines.Select(x => x.Id).ToHashSet();
                foreach (var line in dto.Lines)
                {
                    if (!poLineIds.Contains(line.PurchaseOrderLineId))
                        return BadRequest($"La línea {line.PurchaseOrderLineId} no pertenece a la OC {po.Id}.");

                    var poLine = po.Lines.First(x => x.Id == line.PurchaseOrderLineId);
                    var pending = poLine.Quantity - poLine.ReceivedQuantity;

                    if (line.Quantity > pending)
                        return BadRequest($"Cantidad recibida excede pendiente. Producto: {poLine.ProductName}. Pendiente: {pending}");
                }

                // 3) Cargar productos para validar lotes/seriales
                var productIds = po.Lines.Select(x => x.ProductId).Distinct().ToList();
                var products = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();

                // impuestos usados en recepción
                var taxIds = dto.Lines.Where(x => x.TaxId.HasValue).Select(x => x.TaxId!.Value).Distinct().ToList();
                var taxes = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

                // 4) Crear Recepción
                var receipt = new PurchaseReceipt
                {
                    DocNumber = await GenerateNextReceiptNumber(),
                    ReceiptDate = receiptDate,
                    PurchaseOrderId = po.Id,
                    SupplierId = po.SupplierId,
                    SupplierName = po.SupplierName,
                    WarehouseId = po.WarehouseId,
                    Comments = dto.Comments,
                    Status = "POSTED",
                    IsInvoiced = false,
                    InvoicedAt = null,
                    InvoiceNumber = null,
                    InvoiceDate = null,
                    InvoiceDueDate = null,
                    InvoiceTotal = null
                };

                if (dto.Documents != null && dto.Documents.Count > 0)
                {
                    foreach (var d in dto.Documents)
                    {
                        var type = (d.Type ?? "").Trim().ToUpperInvariant();
                        if (type != "INVOICE" && type != "DELIVERY_NOTE")
                            return BadRequest("Tipo de documento inválido. Use INVOICE o DELIVERY_NOTE.");

                        var number = (d.Number ?? "").Trim();
                        if (string.IsNullOrWhiteSpace(number))
                            return BadRequest("El número de documento no puede ser vacío.");

                        receipt.Documents.Add(new PurchaseReceiptDocument
                        {
                            Type = type,
                            Number = number,
                            Date = d.Date
                        });
                    }
                }

                // 5) Construir líneas de recepción + totales
                foreach (var l in dto.Lines)
                {
                    var poLine = po.Lines.First(x => x.Id == l.PurchaseOrderLineId);
                    var product = products.First(p => p.Id == poLine.ProductId);
                    var tax = l.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == l.TaxId.Value) : null;

                    // Validar lote/serial según producto
                    if (product.IsBatchManaged && string.IsNullOrWhiteSpace(l.BatchNumber))
                        return BadRequest($"El producto {product.Name} requiere BatchNumber.");

                    if (product.IsSerialManaged && string.IsNullOrWhiteSpace(l.SerialNumbers))
                        return BadRequest($"El producto {product.Name} requiere SerialNumbers.");

                    // Si es serializado: cantidad debe coincidir con cantidad de seriales
                    if (product.IsSerialManaged)
                    {
                        var serialCount = l.SerialNumbers!
                            .Split(",", StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim())
                            .Where(x => !string.IsNullOrWhiteSpace(x))
                            .Count();

                        if (serialCount != (int)l.Quantity)
                            return BadRequest($"Seriales no coinciden con cantidad en {product.Name}. Cant: {l.Quantity}, Seriales: {serialCount}");
                    }

                    var discountFactor = (100m - l.DiscountPercent) / 100m;
                    var sub = Math.Round(l.Quantity * l.UnitPrice * discountFactor, 2);

                    var taxRate = tax?.Rate ?? 0m;
                    var taxAmt = Math.Round(sub * (taxRate / 100m), 2);
                    var total = sub + taxAmt;

                    receipt.Lines.Add(new PurchaseReceiptLine
                    {
                        PurchaseOrderLineId = poLine.Id,
                        ProductId = product.Id,
                        ProductCode = product.Code,
                        ProductName = product.Name,
                        Quantity = l.Quantity,
                        UnitPrice = l.UnitPrice,
                        DiscountPercent = l.DiscountPercent,
                        TaxId = l.TaxId,

                        BatchNumber = l.BatchNumber,
                        ExpirationDate = l.ExpirationDate,
                        SerialNumbers = l.SerialNumbers,

                        LineSubTotal = sub,
                        LineTax = taxAmt,
                        LineTotal = total
                    });

                    // 6) Actualizar recibido en OC
                    poLine.ReceivedQuantity += l.Quantity;
                }

                receipt.SubTotal = receipt.Lines.Sum(x => x.LineSubTotal);
                receipt.TaxTotal = receipt.Lines.Sum(x => x.LineTax);
                receipt.Total = receipt.Lines.Sum(x => x.LineTotal);

                _ctx.PurchaseReceipts.Add(receipt);

                // 7) Cerrar OC si ya no queda pendiente
                var allReceived = po.Lines.All(x => x.ReceivedQuantity >= x.Quantity);
                if (allReceived)
                {
                    po.Status = "CLOSED";
                    po.UpdatedAt = DateTime.UtcNow;
                }

                await _ctx.SaveChangesAsync();

                // 8) Generar StockEntry con tu lógica existente (impacta stock)
                var entry = new StockEntry
                {
                    DocumentType = "PURCHASE_RECEIPT",
                    DocumentNumber = receipt.DocNumber,
                    DocumentRef = $"PO:{po.DocNumber}",     // referencia a la OC
                    EntryDate = receipt.ReceiptDate,

                    WarehouseId = receipt.WarehouseId,

                    SupplierId = receipt.SupplierId,
                    SupplierName = receipt.SupplierName,
                    Notes = receipt.Comments,
                    EntryMode = "ADD",
                    CreatedBy = User.Identity?.Name ?? "system",

                    Lines = receipt.Lines.Select(l =>
                    {
                        var taxRate = l.TaxId.HasValue
                            ? (taxes.FirstOrDefault(t => t.Id == l.TaxId.Value)?.Rate ?? 0m)
                            : 0m;

                        var disc = l.DiscountPercent;
                        if (disc < 0m) disc = 0m;
                        if (disc > 100m) disc = 100m;

                        var unitNet = l.UnitPrice * ((100m - disc) / 100m); // ✅ neto de descuento
                                                // Nota: IVA lo dejamos fuera del costo (tu doc ya separa LineTax). Si querés incluirlo, lo hacemos.

                        return new StockEntryLine
                        {
                            ProductId = l.ProductId,
                            WarehouseId = receipt.WarehouseId,
                            Quantity = l.Quantity,
                            UnitCost = unitNet,           // ✅
                            TaxRate = taxRate,
                            BatchNumber = l.BatchNumber,
                            ExpirationDate = l.ExpirationDate,
                            SerialNumbers = l.SerialNumbers
                        };
                    }).ToList()


                };

                await ApplyStockEntry(entry);

                await trx.CommitAsync();

                return Ok(new { receiptId = receipt.Id, receipt.DocNumber, stockEntry = entry });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error en recepción: {ex.Message}");
            }
        }

            
        [RequirePermission(Perms.PurchaseReceiptsEdit)]
        [HttpPost("{id}/documents/upsert")]
        public async Task<IActionResult> UpsertDocument(int id, PurchaseReceiptUpsertDocDto dto)
        {
            var receipt = await _ctx.PurchaseReceipts
                .Include(x => x.Documents)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (receipt == null) return NotFound();

            if (receipt.IsCancelled || (receipt.Status ?? "").ToUpper() == "CANCELLED")
                return BadRequest("No se puede editar una recepción cancelada.");

            var type = (dto.Type ?? "").Trim().ToUpperInvariant();
            if (type != "INVOICE" && type != "DELIVERY_NOTE")
                return BadRequest("Tipo inválido. Use INVOICE o DELIVERY_NOTE.");

            var number = (dto.Number ?? "").Trim();
            if (string.IsNullOrWhiteSpace(number))
                return BadRequest("Número requerido.");

            // si ya existe documento de ese TIPO, lo actualiza (simple para el usuario)
            var existing = receipt.Documents.FirstOrDefault(d => d.Type == type);

            if (existing == null)
            {
                receipt.Documents.Add(new PurchaseReceiptDocument
                {
                    Type = type,
                    Number = number,
                    Date = dto.Date
                });
            }
            else
            {
                existing.Number = number;
                existing.Date = dto.Date;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return Ok(receipt.Documents);
        }

        [RequirePermission(Perms.PurchaseReceiptsEdit)]
        [HttpPut("{id}/documents")]
        public async Task<IActionResult> UpdateDocuments(int id, [FromBody] UpdatePurchaseReceiptDocumentsRequest req)
        {

            var doc = await _ctx.PurchaseReceipts
                .Include(x => x.Documents)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            if (doc.IsCancelled || (doc.Status ?? "").ToUpper() == "CANCELLED")
                return BadRequest("No se puede editar una recepción cancelada.");

            // Normalizar
            var incoming = (req.Documents ?? new List<PurchaseReceiptDocumentDto>())
                .Where(d => !string.IsNullOrWhiteSpace(d.Type))
                .Select(d => new
                {
                    Type = d.Type.Trim().ToUpper(),
                    Number = (d.Number ?? "").Trim(),
                    Date = d.Date
                })
                .ToList();

            // Regla: si viene un tipo, debe tener número
            foreach (var d in incoming)
            {
                if ((d.Type == "DELIVERY_NOTE" || d.Type == "INVOICE") && string.IsNullOrWhiteSpace(d.Number))
                    return BadRequest($"El documento {d.Type} requiere Number.");
            }

            // Solo permitimos estos tipos (si querés otros, agregalos)
            var allowed = new HashSet<string> { "DELIVERY_NOTE", "INVOICE" };
            if (incoming.Any(d => !allowed.Contains(d.Type)))
                return BadRequest("Tipo de documento no permitido. Use DELIVERY_NOTE o INVOICE.");

            // Upsert por Type (1 por tipo)
            foreach (var t in allowed)
            {
                var inc = incoming.FirstOrDefault(x => x.Type == t);
                var existing = doc.Documents.FirstOrDefault(x => x.Type.ToUpper() == t);

                if (inc == null)
                {
                    // si no viene, borramos (opcional). Si no querés borrar, comentá este bloque.
                    if (existing != null) _ctx.Remove(existing);
                    continue;
                }

                if (existing == null)
                {
                    // crear
                    doc.Documents.Add(new PurchaseReceiptDocument
                    {
                        Type = t,
                        Number = inc.Number,
                        Date = inc.Date
                    });
                }
                else
                {
                    // actualizar
                    existing.Number = inc.Number;
                    existing.Date = inc.Date;
                }
            }

            await _ctx.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        [RequirePermission(Perms.PurchaseReceiptsEdit)]
        [HttpPut("{id}/pricing")]
        public async Task<IActionResult> UpdatePricing(int id, [FromBody] UpdatePurchaseReceiptPricingRequest req)
        {
            var doc = await _ctx.PurchaseReceipts
                .Include(x => x.Lines)
                .ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            if (doc.IsCancelled || (doc.Status ?? "").ToUpper() == "CANCELLED")
                return BadRequest("No se puede editar una recepción cancelada.");

            var incoming = req.Lines ?? new List<UpdatePurchaseReceiptLinePriceDto>();
            if (!incoming.Any()) return BadRequest("No hay líneas para actualizar.");

            foreach (var l in incoming)
            {
                if (l.UnitPrice < 0) return BadRequest("UnitPrice inválido.");
                if (l.DiscountPercent < 0 || l.DiscountPercent > 100) return BadRequest("DiscountPercent inválido (0..100).");

                var line = doc.Lines.FirstOrDefault(x => x.Id == l.LineId);
                if (line == null) return BadRequest($"Linea no encontrada: {l.LineId}");

                // ✅ Solo precios/desc/tax. NO tocamos cantidad, ni stock.
                line.UnitPrice = l.UnitPrice;
                line.DiscountPercent = l.DiscountPercent;
                line.TaxId = l.TaxId;
            }

            // Recalcular totales del documento (ajusta a tu lógica real)
            decimal sub = 0m;
            decimal tax = 0m;

            foreach (var line in doc.Lines)
            {
                var disc = line.DiscountPercent;
                if (disc < 0m) disc = 0m;
                if (disc > 100m) disc = 100m;

                var discFactor = (100m - disc) / 100m;
                var lineSub = line.Quantity * line.UnitPrice * discFactor;
                sub += lineSub;

                // Si tenés Tax con rate
                var rate = line.Tax?.Rate ?? 0m; // Ajustá según tu entidad
                tax += lineSub * (rate / 100m);
            }

            doc.SubTotal = sub;
            doc.TaxTotal = tax;
            doc.Total = sub + tax;

            await _ctx.SaveChangesAsync();
            return Ok(new { ok = true, doc.SubTotal, doc.TaxTotal, doc.Total });
        }

        [RequirePermission(Perms.PurchaseReceiptsEdit)]
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] PurchaseReceiptCancelDto dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la cancelación.");

                // 1) Traer recepción completa
                var receipt = await _ctx.PurchaseReceipts
                    .Include(x => x.PurchaseOrder)
                        .ThenInclude(po => po.Lines)
                    .Include(x => x.Lines)
                        .ThenInclude(l => l.Product)
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (receipt == null) return NotFound("Recepción no existe.");

                if (receipt.IsCancelled) return BadRequest("La recepción ya está cancelada.");

                if ((receipt.Status ?? "").ToUpperInvariant() != "POSTED")
                    return BadRequest("Solo se puede cancelar una recepción en estado POSTED.");

                if (receipt.IsInvoiced)
                    return BadRequest("No se puede cancelar: la recepción ya está FACTURADA.");


                // 2) Validar y revertir OC (solo si es remisión con OC)
                var po = receipt.PurchaseOrder;

                if (po != null)
                {
                    foreach (var rl in receipt.Lines)
                    {
                        var poLine = po.Lines.FirstOrDefault(x => x.Id == rl.PurchaseOrderLineId);
                        if (poLine == null)
                            return BadRequest($"Línea OC no encontrada: {rl.PurchaseOrderLineId}");
                        if (poLine.ReceivedQuantity < rl.Quantity)
                            return BadRequest($"No se puede cancelar: recibido en OC sería negativo. Producto: {poLine.ProductName}");
                    }
                }

                // 3) Preparar un StockOutput (audit)
                var cancelDocNumber = $"CAN-{receipt.DocNumber}";

                var output = new StockOutput
                {
                    DocumentType = "PURCHASE_RECEIPT_CANCEL",
                    DocumentNumber = cancelDocNumber,
                    OutputDate = DateTime.UtcNow,

                    WarehouseId = receipt.WarehouseId,

                    Notes = string.IsNullOrWhiteSpace(dto?.Reason)
                        ? $"Cancelación de recepción {receipt.DocNumber}"
                        : dto!.Reason!.Trim(),

                    // Si tenés CreatedBy en StockOutput, setearlo. Si no, quitá.
                    CreatedBy = User.Identity?.Name ?? "system",

                    Lines = new List<StockOutputLine>()
                };

                // 4) Construir líneas de salida (espejo exacto)
                foreach (var l in receipt.Lines)
                {
                    output.Lines.Add(new StockOutputLine
                    {
                        ProductId = l.ProductId,
                        WarehouseId = receipt.WarehouseId,
                        Quantity = l.Quantity,

                        BatchNumber = l.BatchNumber,
                        SerialNumbers = l.SerialNumbers,

                        // si tu StockOutputLine tiene más campos, agregalos.
                    });
                }

                // 5) Aplicar salida (descuenta stock, lotes, seriales con validaciones)
                //    Implementamos un "ApplyStockOutput" interno usando la lógica de tu StockOutputController
                await ApplyStockOutput(output);

                // 6) Revertir received en OC (solo si tiene OC)
                if (po != null)
                {
                    foreach (var rl in receipt.Lines)
                    {
                        var poLine = po.Lines.First(x => x.Id == rl.PurchaseOrderLineId);
                        poLine.ReceivedQuantity -= rl.Quantity;
                    }
                    var allReceived = po.Lines.All(x => x.ReceivedQuantity >= x.Quantity);
                    if (!allReceived)
                    {
                        po.Status = "OPEN";
                        po.UpdatedAt = DateTime.UtcNow;
                    }
                }

                // 7) Marcar recepción cancelada
                receipt.Status = "CANCELLED";
                receipt.UpdatedAt = DateTime.UtcNow;
                receipt.CancelledAt = DateTime.UtcNow;
                receipt.CancelReason = dto?.Reason?.Trim();
                receipt.CancelledBy = User.Identity?.Name ?? "system";

                // Si tenés campos específicos, mejor:
                // receipt.CancelledAt = DateTime.UtcNow;
                // receipt.CancelReason = dto?.Reason;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, receiptId = receipt.Id, cancelStockOutput = output.DocumentNumber });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error al cancelar recepción: {ex.Message}");
            }
        }


        [RequirePermission(Perms.PurchaseReceiptsView)]
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> Pdf(int id)
        {
            var doc = await _ctx.PurchaseReceipts
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .Include(x => x.PurchaseOrder)
                .Include(x => x.Documents)
                .Include(x => x.Lines).ThenInclude(l => l.Product)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound("Recepción no existe.");

            var logoPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", "mega7_logo.png");
            byte[]? logoBytes = System.IO.File.Exists(logoPath)
                ? await System.IO.File.ReadAllBytesAsync(logoPath)
                : null;

            var pdfBytes = Mega7.API.Services.Pdf.PurchaseReceiptPdfGenerator.Generate(doc, logoBytes);

            return File(pdfBytes, "application/pdf", $"{doc.DocNumber}.pdf");
        }


        [RequirePermission(Perms.PurchaseReceiptsConfirm)]
        [HttpPost("{id}/invoice")]
        public async Task<IActionResult> UpsertInvoice(int id, [FromBody] PurchaseReceiptInvoiceDto dto)
        {
            var invDate = (dto.InvoiceDate ?? DateTime.UtcNow.Date).Date;
            if (!await _periods.HasOpenPeriodForDate(invDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la factura.");

            if (dto == null) return BadRequest("Payload inválido.");
            if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
                return BadRequest("InvoiceNumber es requerido.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var receipt = await _ctx.PurchaseReceipts
                    .Include(x => x.Documents)
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (receipt == null) return NotFound("Recepción no existe.");

                if (receipt.IsCancelled || (receipt.Status ?? "").ToUpper() == "CANCELLED")
                    return BadRequest("No se puede facturar una recepción cancelada.");

                var st = (receipt.Status ?? "POSTED").ToUpperInvariant();
                if (st != "POSTED")
                    return BadRequest("Solo se puede registrar factura si la recepción está POSTED.");

                // Persistencia “financiera” en Receipt
                receipt.IsInvoiced = true;
                receipt.InvoicedAt = DateTime.UtcNow;

                receipt.InvoiceNumber = dto.InvoiceNumber.Trim();
                receipt.InvoiceDate = dto.InvoiceDate ?? DateTime.UtcNow.Date;
                receipt.InvoiceDueDate = dto.InvoiceDueDate;
                receipt.InvoiceTotal = dto.InvoiceTotal;

                receipt.UpdatedAt = DateTime.UtcNow;

                receipt.InvoiceIsCredit = dto.IsCredit;
                receipt.InvoiceCreditTermId = dto.CreditTermId;
                receipt.InvoiceInstallments = dto.Installments;

                // (opcional) sincronizar tabla Documents con tipo INVOICE
                if (dto.UpsertInvoiceDocument)
                {
                    var inv = receipt.Documents.FirstOrDefault(d => (d.Type ?? "").ToUpper() == "INVOICE");
                    if (inv == null)
                    {
                        receipt.Documents.Add(new PurchaseReceiptDocument
                        {
                            Type = "INVOICE",
                            Number = receipt.InvoiceNumber,
                            Date = receipt.InvoiceDate
                        });
                    }
                    else
                    {
                        inv.Number = receipt.InvoiceNumber;
                        inv.Date = receipt.InvoiceDate;
                        inv.UpdatedAt = DateTime.UtcNow;
                    }
                }

                // ✅ HOOK: crear/actualizar APInvoice (CxP) y RETORNAR
                var ap = await UpsertApInvoiceForReceipt(receipt);

                await _ctx.SaveChangesAsync();

                if (ap != null)
                    try { await _accounting.PostAPInvoiceAsync(ap.Id); } catch { }

                await trx.CommitAsync();

                // ✅ Diferencia (Factura – Recepción): NO bloquear, solo informar
                var receiptTotal = receipt.Total;
                var receiptInvoiceTotal = receipt.InvoiceTotal ?? receipt.Total;
                var apInvoiceTotal = ap?.Total ?? receiptInvoiceTotal;
                var diff = apInvoiceTotal - receiptTotal;

                return Ok(new
                {
                    ok = true,
                    receipt.Id,
                    receipt.DocNumber,

                    receipt.IsInvoiced,
                    receipt.InvoicedAt,
                    receipt.InvoiceNumber,
                    receipt.InvoiceDate,
                    receipt.InvoiceDueDate,

                    receiptInvoiceTotal, // ✅ NO colisiona
                    apInvoiceId = ap?.Id,
                    apInvoiceTotal,      // ✅ NO colisiona

                    receiptTotal,
                    diff
                });

            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }


        [RequirePermission(Perms.PurchaseReceiptsEdit)]
        [HttpPost("{id}/invoice/clear")]
        public async Task<IActionResult> ClearInvoice(int id, [FromBody] PurchaseReceiptInvoiceClearDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la anulación de factura.");

                var receipt = await _ctx.PurchaseReceipts
                    .Include(x => x.Documents)
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (receipt == null) return NotFound("Recepción no existe.");

                if (receipt.IsCancelled || (receipt.Status ?? "").ToUpper() == "CANCELLED")
                    return BadRequest("No se puede modificar factura de una recepción cancelada.");

                var st = (receipt.Status ?? "POSTED").ToUpperInvariant();
                if (st != "POSTED")
                    return BadRequest("Solo se puede limpiar factura si la recepción está POSTED.");

                // ✅ cancelar CxP (auditoría)
                await CancelApInvoiceForReceipt(id);

                // Limpiar datos financieros en Receipt
                receipt.IsInvoiced = false;
                receipt.InvoicedAt = null;
                receipt.InvoiceNumber = null;
                receipt.InvoiceDate = null;
                receipt.InvoiceDueDate = null;
                receipt.InvoiceTotal = null;
                receipt.UpdatedAt = DateTime.UtcNow;

                receipt.InvoiceIsCredit = null;
                receipt.InvoiceCreditTermId = null;
                receipt.InvoiceInstallments = null;

                // (opcional) remover documento INVOICE
                if (dto?.AlsoRemoveInvoiceDocument ?? true)
                {
                    var inv = receipt.Documents.FirstOrDefault(d => (d.Type ?? "").ToUpper() == "INVOICE");
                    if (inv != null) _ctx.Remove(inv);
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

        // SERVICIOS AUXILIARES INTERNOS

        private async Task ApplyStockEntry(StockEntry entry)
        {
            if (entry.Lines == null || entry.Lines.Count == 0)
                throw new Exception("No se puede crear un ingreso sin líneas.");

            _ctx.StockEntries.Add(entry);
            await _ctx.SaveChangesAsync();

            // helpers
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

                // 1) STOCK GENERAL (qty + avg cost)
                var stock = await _ctx.Stocks
                    .FirstOrDefaultAsync(s => s.ProductId == line.ProductId && s.WarehouseId == line.WarehouseId);

                if (stock == null)
                {
                    stock = new Stock
                    {
                        ProductId = line.ProductId,
                        WarehouseId = line.WarehouseId,
                        Quantity = 0,
                        AvgCost = 0
                    };
                    _ctx.Stocks.Add(stock);
                }

                var oldQty = stock.Quantity;
                var oldAvg = stock.AvgCost;

                stock.Quantity += line.Quantity;

                // ✅ promedio SOLO si NO es lote/serial (si lo es, el costo sale del batch/serial)
                if (!product.IsBatchManaged && !product.IsSerialManaged)
                {
                    stock.AvgCost = WeightedAvg(oldQty, oldAvg, line.Quantity, line.UnitCost);
                    if (stock.Quantity <= 0) stock.AvgCost = 0m;
                }

                // 2) LOTES (qty + unitcost del lote)
                if (product.IsBatchManaged)
                {
                    if (string.IsNullOrWhiteSpace(line.BatchNumber))
                        throw new Exception("El producto es loteable. Debe especificar BatchNumber.");

                    var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                        b.ProductId == line.ProductId &&
                        b.WarehouseId == line.WarehouseId &&
                        b.BatchNumber == line.BatchNumber);

                    if (batch == null)
                    {
                        batch = new Batch
                        {
                            ProductId = line.ProductId,
                            WarehouseId = line.WarehouseId,
                            BatchNumber = line.BatchNumber!,
                            ExpirationDate = line.ExpirationDate,
                            Quantity = 0,
                            UnitCost = line.UnitCost // ✅ costo inicial del lote
                        };
                        _ctx.Batches.Add(batch);
                    }
                    else
                    {
                        // ✅ si vuelve a entrar al mismo lote, ponderamos costo del lote
                        batch.UnitCost = WeightedAvg(batch.Quantity, batch.UnitCost, line.Quantity, line.UnitCost);
                    }

                    batch.Quantity += line.Quantity;
                    batch.UpdatedAt = DateTime.UtcNow;
                }

                // 3) SERIALES (guardar costo por serial)
                if (product.IsSerialManaged)
                {
                    if (string.IsNullOrWhiteSpace(line.SerialNumbers))
                        throw new Exception("Debe enviar SerialNumbers para productos serializables.");

                    var serialList = line.SerialNumbers
                        .Split(",", StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .ToList();

                    foreach (var sn in serialList)
                    {
                        // (opcional) evitar duplicados
                        var exists = await _ctx.Serials.AnyAsync(s =>
                            s.ProductId == product.Id &&
                            s.WarehouseId == line.WarehouseId &&
                            s.SerialNumber == sn);

                        if (exists) throw new Exception($"El serial {sn} ya existe para este producto/depósito.");

                        _ctx.Serials.Add(new Serial
                        {
                            ProductId = product.Id,
                            WarehouseId = line.WarehouseId,
                            SerialNumber = sn,
                            IsActive = true,
                            UnitCost = line.UnitCost, // ✅ costo específico
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }


            await _ctx.SaveChangesAsync();
        }

        private async Task<string> GenerateNextReceiptNumber()
        {
            var last = await _ctx.PurchaseReceipts
                .OrderByDescending(x => x.Id)
                .Select(x => x.DocNumber)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(last))
                return "RC000001";

            var numPart = new string(last.Where(char.IsDigit).ToArray());
            if (!int.TryParse(numPart, out var n)) n = 0;

            n++;
            return $"RC{n:D6}";
        }

        private async Task ApplyStockOutput(StockOutput output)
        {
            if (output.Lines == null || !output.Lines.Any())
                throw new Exception("No se puede crear una salida sin líneas.");

            // separar líneas para evitar inserts raros
            var lines = output.Lines.ToList();
            output.Lines = new List<StockOutputLine>();

            output.Id = 0;
            _ctx.StockOutputs.Add(output);
            await _ctx.SaveChangesAsync(); // output.Id

            foreach (var line in lines)
            {
                line.Id = 0;
                line.StockOutputId = output.Id;
                line.StockOutput = null;

                var product = await _ctx.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId);
                if (product == null)
                    throw new Exception($"Producto no encontrado (ID {line.ProductId})");

                // STOCK GENERAL
                var stock = await _ctx.Stocks.FirstOrDefaultAsync(s =>
                    s.ProductId == line.ProductId &&
                    s.WarehouseId == line.WarehouseId);

                if (stock == null || stock.Quantity < line.Quantity)
                    throw new Exception($"No se puede cancelar: stock insuficiente del producto {product.Name} en el depósito.");

                // =========================
                // ✅ COSTEO (UnitCostApplied / LineCost)
                // =========================
                decimal unitCostApplied = 0m;

                // LOTES
                if (product.IsBatchManaged)
                {
                    if (string.IsNullOrWhiteSpace(line.BatchNumber))
                        throw new Exception($"El producto {product.Name} requiere lote.");

                    var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                        b.ProductId == line.ProductId &&
                        b.WarehouseId == line.WarehouseId &&
                        b.BatchNumber == line.BatchNumber);

                    if (batch == null)
                        throw new Exception($"No se puede cancelar: lote {line.BatchNumber} no existe en este depósito.");

                    if (batch.Quantity < line.Quantity)
                        throw new Exception($"No se puede cancelar: stock insuficiente en lote {line.BatchNumber} (Producto: {product.Name}).");

                    unitCostApplied = batch.UnitCost; // ✅ costo lote

                    batch.Quantity -= line.Quantity;
                    batch.UpdatedAt = DateTime.UtcNow;
                }

                // SERIALES
                if (product.IsSerialManaged)
                {
                    if (string.IsNullOrWhiteSpace(line.SerialNumbers))
                        throw new Exception($"Debe cargar los números de serie del producto {product.Name}.");

                    var serialList = line.SerialNumbers
                        .Split(new[] { ",", ";", "\n", "\r" }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Distinct()
                        .ToList();

                    if (serialList.Count != (int)line.Quantity)
                        throw new Exception($"Seriales no coinciden con cantidad en {product.Name}. Cant: {line.Quantity}, Seriales: {serialList.Count}");

                    decimal totalSerialCost = 0m;

                    foreach (var sn in serialList)
                    {
                        var serial = await _ctx.Serials.FirstOrDefaultAsync(s =>
                            s.ProductId == product.Id &&
                            s.WarehouseId == line.WarehouseId &&
                            s.SerialNumber == sn &&
                            s.IsActive == true);

                        if (serial == null)
                            throw new Exception($"No se puede cancelar: el serial {sn} no está disponible en este depósito (ya fue usado/salió).");

                        totalSerialCost += serial.UnitCost; // ✅ costo serial

                        // Cancelación de recepción = salida de stock => serial deja de estar disponible
                        serial.IsActive = false;
                        serial.UpdatedAt = DateTime.UtcNow;
                    }

                    unitCostApplied = serialList.Count == 0 ? 0m : (totalSerialCost / serialList.Count);
                }

                // NORMAL
                if (!product.IsBatchManaged && !product.IsSerialManaged)
                {
                    unitCostApplied = stock.AvgCost; // ✅ promedio
                }

                line.UnitCostApplied = unitCostApplied;
                line.LineCost = Math.Round(line.Quantity * unitCostApplied, 2);

                // DESCONTAR STOCK GENERAL
                stock.Quantity -= line.Quantity;
                if (stock.Quantity <= 0) stock.Quantity = 0;

                _ctx.StockOutputLines.Add(line);
            }

            await _ctx.SaveChangesAsync();
        }

        private async Task<APInvoice?> UpsertApInvoiceForReceipt(PurchaseReceipt receipt)
        {
            if (receipt.IsCancelled || (receipt.Status ?? "").ToUpper() == "CANCELLED")
                return null;

            if (!receipt.IsInvoiced || string.IsNullOrWhiteSpace(receipt.InvoiceNumber))
                return null;

            var supplier = await _ctx.SociosNegocio
                .Include(s => s.CreditTerm)
                .FirstOrDefaultAsync(s => s.Id == receipt.SupplierId);

            var invoiceDate = (receipt.InvoiceDate ?? DateTime.UtcNow.Date).Date;

            bool isCredit = receipt.InvoiceIsCredit ?? true; // default crédito
            int? overrideTermId = receipt.InvoiceCreditTermId;
            int? overrideInstallments = receipt.InvoiceInstallments;

            int creditDays = 0;

            if (!isCredit)
            {
                creditDays = 0;
            }
            else
            {
                if (overrideTermId.HasValue)
                {
                    var term = await _ctx.CreditTerms.AsNoTracking()
                        .FirstOrDefaultAsync(t => t.Id == overrideTermId.Value);

                    creditDays = term?.Days ?? 0;
                }
                else
                {
                    creditDays = supplier?.CreditTerm?.Days ?? 0;
                }
            }

            var baseDueDate = (receipt.InvoiceDueDate?.Date) ??
                              (isCredit ? invoiceDate.AddDays(creditDays) : invoiceDate);

            var newTotal = receipt.InvoiceTotal ?? receipt.Total;

            var ap = await _ctx.APInvoices
                .Include(x => x.Installments)
                .FirstOrDefaultAsync(x => x.PurchaseReceiptId == receipt.Id);

            if (ap == null)
            {
                ap = new APInvoice
                {
                    PurchaseReceiptId = receipt.Id,
                    SupplierId = receipt.SupplierId,
                    SupplierName = receipt.SupplierName,

                    InvoiceNumber = receipt.InvoiceNumber!.Trim(),
                    InvoiceDate = invoiceDate,
                    DueDate = baseDueDate,

                    Total = newTotal,
                    Balance = newTotal,
                    Status = "OPEN",
                    CreatedAt = DateTime.UtcNow
                };

                _ctx.APInvoices.Add(ap);
                await _ctx.SaveChangesAsync();
            }
            else
            {
                var st = (ap.Status ?? "OPEN").ToUpperInvariant();
                if (st == "PAID")
                    throw new Exception("No se puede actualizar la CxP: la factura ya está pagada.");

                if (st == "CANCELLED")
                {
                    ap.Status = "OPEN";
                    ap.CancelledAt = null;
                    ap.CancelReason = null;
                }

                ap.SupplierId = receipt.SupplierId;
                ap.SupplierName = receipt.SupplierName;

                ap.InvoiceNumber = receipt.InvoiceNumber!.Trim();
                ap.InvoiceDate = invoiceDate;
                ap.DueDate = baseDueDate;

                if (st == "OPEN")
                {
                    ap.Total = newTotal;
                    ap.Balance = newTotal;
                }
                else if (st == "PARTIAL")
                {
                    ap.Total = newTotal;
                    if (ap.Balance > newTotal) ap.Balance = newTotal;
                }
                else
                {
                    ap.Total = newTotal;
                    ap.Balance = newTotal;
                    ap.Status = "OPEN";
                }

                ap.UpdatedAt = DateTime.UtcNow;
            }

            // ✅ LOG DIFERENCIA (NO BLOQUEA)
            var diff = ap.Total - receipt.Total;
            if (Math.Abs(diff) >= 0.01m)
            {
                _logger.LogWarning(
                    "APInvoice diff detected. ReceiptId={ReceiptId} ReceiptDoc={ReceiptDoc} SupplierId={SupplierId} Supplier={Supplier} ReceiptTotal={ReceiptTotal} InvoiceTotal={InvoiceTotal} Diff={Diff}",
                    receipt.Id,
                    receipt.DocNumber,
                    receipt.SupplierId,
                    receipt.SupplierName,
                    receipt.Total,
                    ap.Total,
                    diff
                );
            }

            // ====== CUOTAS ======
            int n = 0;

            if (isCredit)
            {
                if (overrideInstallments.HasValue)
                {
                    n = overrideInstallments.Value;
                }
                else
                {
                    var allow = supplier?.AllowInstallments ?? false;
                    n = allow ? (supplier?.DefaultInstallments ?? 0) : 0;
                }
            }

            if (n < 2) n = 0;

            if (n >= 2)
            {
                await RegenerateInstallments(ap.Id, ap.Total, baseDueDate, n);
                await RecalculateInstallmentsFromPayments(ap.Id);
            }
            else
            {
                var paidSum = await _ctx.APInvoicePayments
                    .Where(p => p.APInvoiceId == ap.Id && !p.IsCancelled)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                if (paidSum == 0m)
                {
                    var prev = await _ctx.APInvoiceInstallments
                        .Where(x => x.APInvoiceId == ap.Id)
                        .ToListAsync();

                    if (prev.Count > 0)
                        _ctx.APInvoiceInstallments.RemoveRange(prev);
                }
            }

            await _ctx.SaveChangesAsync();
            return ap;
        }


        private async Task CancelApInvoiceForReceipt(int receiptId)
        {
            var ap = await _ctx.APInvoices
                .Include(x => x.Payments)
                .FirstOrDefaultAsync(x => x.PurchaseReceiptId == receiptId);

            if (ap == null)
                return;

            var paidSum = ap.Payments
                .Where(p => !p.IsCancelled)
                .Sum(p => p.Amount);

            if (paidSum > 0)
                throw new InvalidOperationException(
                    "No se puede cancelar la CxP asociada a la recepción porque tiene pagos.");

            ap.Status = "CANCELLED";
            ap.CancelledAt = DateTime.UtcNow;
            ap.CancelReason = "Factura desvinculada de la recepción.";
            ap.Balance = 0m;
            ap.PaidAt = null;
            ap.UpdatedAt = DateTime.UtcNow;
        }

        //private static void RecalcInvoiceFromPayments(APInvoice inv, decimal paidSum)
        //{
        //    var balance = inv.Total - paidSum;
        //    if (balance < 0) balance = 0;

        //    inv.Balance = balance;

        //    if (inv.Status?.ToUpperInvariant() == "CANCELLED")
        //        return;

        //    if (inv.Balance == 0m)
        //    {
        //        inv.Status = "PAID";
        //        if (!inv.PaidAt.HasValue)
        //            inv.PaidAt = DateTime.UtcNow;
        //    }
        //    else if (inv.Balance < inv.Total)
        //    {
        //        inv.Status = "PARTIAL";
        //        inv.PaidAt = null;
        //    }
        //    else
        //    {
        //        inv.Status = "OPEN";
        //        inv.PaidAt = null;
        //    }
        //}

        private async Task RegenerateInstallments(int apInvoiceId, decimal total, DateTime baseDueDate, int installments)
        {
            // 1) Eliminar siempre cuotas previas
            var prev = await _ctx.APInvoiceInstallments
                .Where(x => x.APInvoiceId == apInvoiceId)
                .ToListAsync();

            if (prev.Count > 0)
                _ctx.APInvoiceInstallments.RemoveRange(prev);

            // 2) Si no hay plan de cuotas (0 o 1) => NO crear cuotas
            if (installments < 2)
                return;

            // 3) Crear cuotas (>= 2)
            var n = installments;

            // Monto base con redondeo financiero
            var baseAmount = Math.Round(total / n, 2, MidpointRounding.AwayFromZero);
            var accumulated = 0m;

            for (int i = 1; i <= n; i++)
            {
                // Última cuota ajusta centavos
                var amount = (i == n)
                    ? total - accumulated
                    : baseAmount;

                accumulated += amount;

                // Regla: cuota 1 vence en baseDueDate, luego cada 30 días
                var dueDate = baseDueDate.AddDays(30 * (i - 1));

                _ctx.APInvoiceInstallments.Add(new APInvoiceInstallment
                {
                    APInvoiceId = apInvoiceId,
                    InstallmentNo = i,
                    DueDate = dueDate.Date,
                    Amount = amount,
                    PaidAmount = 0m,
                    Balance = amount,
                    Status = "OPEN",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        private async Task RecalculateInstallmentsFromPayments(int apInvoiceId)
        {
            var installments = await _ctx.APInvoiceInstallments
                .Where(x => x.APInvoiceId == apInvoiceId)
                .OrderBy(x => x.InstallmentNo)
                .ToListAsync();

            if (installments.Count == 0) return;

            // reset
            foreach (var ins in installments)
            {
                ins.PaidAmount = 0m;
                ins.Balance = ins.Amount;
                ins.Status = "OPEN";
                ins.UpdatedAt = DateTime.UtcNow;
            }

            var payments = await _ctx.APInvoicePayments
                .AsNoTracking()
                .Where(p => p.APInvoiceId == apInvoiceId && !p.IsCancelled)
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

                    ins.Status = (ins.Balance <= 0) ? "PAID" : "OPEN";
                    ins.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        // ── RECEPCIÓN DIRECTA (sin OC) ────────────────────────────────────────────

        [RequirePermission(Perms.PurchaseReceiptsCreate)]
        [HttpPost("direct")]
        public async Task<IActionResult> CreateDirect([FromBody] PurchaseReceiptDirectCreateDto dto)
        {
            var receiptDate = dto.ReceiptDate == default ? DateTime.UtcNow : dto.ReceiptDate;

            if (!await _periods.HasOpenPeriodForDate(receiptDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la recepción.");

            if (dto.SupplierId <= 0)  return BadRequest("SupplierId inválido.");
            if (dto.WarehouseId <= 0) return BadRequest("WarehouseId inválido.");
            if (dto.DirectLines == null || dto.DirectLines.Count == 0)
                return BadRequest("No se puede crear una recepción sin líneas.");
            if (dto.DirectLines.Any(l => l.Quantity <= 0))
                return BadRequest("Cantidad recibida debe ser > 0.");

            var supplier  = await _ctx.SociosNegocio.FirstOrDefaultAsync(s => s.Id == dto.SupplierId);
            if (supplier == null) return BadRequest("Proveedor no encontrado.");

            var warehouse = await _ctx.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId);
            if (warehouse == null) return BadRequest("Depósito no encontrado.");

            using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                var productIds = dto.DirectLines.Select(l => l.ProductId).Distinct().ToList();
                var products   = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();

                var taxIds = dto.DirectLines.Where(l => l.TaxId.HasValue).Select(l => l.TaxId!.Value).Distinct().ToList();
                var taxes  = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

                var receipt = new PurchaseReceipt
                {
                    DocNumber      = await GenerateNextReceiptNumber(),
                    ReceiptDate    = receiptDate,
                    PurchaseOrderId = null,       // directo — sin OC
                    SupplierId     = supplier.Id,
                    SupplierName   = supplier.RazonSocial,
                    WarehouseId    = warehouse.Id,
                    Comments       = dto.Comments?.Trim(),
                    Status         = "POSTED",
                    IsInvoiced     = false,
                };

                foreach (var l in dto.DirectLines)
                {
                    var product = products.FirstOrDefault(p => p.Id == l.ProductId);
                    if (product == null) return BadRequest($"Producto no encontrado (ID {l.ProductId}).");

                    if (product.IsBatchManaged && string.IsNullOrWhiteSpace(l.BatchNumber))
                        return BadRequest($"El producto {product.Name} requiere BatchNumber.");

                    if (product.IsSerialManaged)
                    {
                        if (string.IsNullOrWhiteSpace(l.SerialNumbers))
                            return BadRequest($"El producto {product.Name} requiere SerialNumbers.");

                        var serialCount = l.SerialNumbers!
                            .Split(',', StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)).Count();

                        if (serialCount != (int)l.Quantity)
                            return BadRequest($"Seriales no coinciden con cantidad en {product.Name}. Cant: {l.Quantity}, Seriales: {serialCount}");
                    }

                    var tax           = l.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == l.TaxId.Value) : null;
                    var discFactor    = (100m - Math.Clamp(l.DiscountPercent, 0m, 100m)) / 100m;
                    var sub           = Math.Round(l.Quantity * l.UnitPrice * discFactor, 2);
                    var taxAmt        = Math.Round(sub * ((tax?.Rate ?? 0m) / 100m), 2);

                    receipt.Lines.Add(new PurchaseReceiptLine
                    {
                        PurchaseOrderLineId = null,   // sin OC
                        ProductId           = product.Id,
                        ProductCode         = product.Code,
                        ProductName         = product.Name,
                        Quantity            = l.Quantity,
                        UnitPrice           = l.UnitPrice,
                        DiscountPercent     = l.DiscountPercent,
                        TaxId               = l.TaxId,
                        BatchNumber         = l.BatchNumber,
                        ExpirationDate      = l.ExpirationDate,
                        SerialNumbers       = l.SerialNumbers,
                        LineSubTotal        = sub,
                        LineTax             = taxAmt,
                        LineTotal           = sub + taxAmt,
                    });
                }

                receipt.SubTotal = receipt.Lines.Sum(x => x.LineSubTotal);
                receipt.TaxTotal = receipt.Lines.Sum(x => x.LineTax);
                receipt.Total    = receipt.Lines.Sum(x => x.LineTotal);

                _ctx.PurchaseReceipts.Add(receipt);
                await _ctx.SaveChangesAsync();

                // ── Stock entry (mismo flujo que recepción con OC) ──────────────
                var entry = new StockEntry
                {
                    DocumentType   = "PURCHASE_RECEIPT",
                    DocumentNumber = receipt.DocNumber,
                    DocumentRef    = "DIRECTO",
                    EntryDate      = receipt.ReceiptDate,
                    WarehouseId    = receipt.WarehouseId,
                    SupplierId     = receipt.SupplierId,
                    SupplierName   = receipt.SupplierName,
                    Notes          = receipt.Comments,
                    EntryMode      = "ADD",
                    CreatedBy      = User.Identity?.Name ?? "system",
                    Lines = receipt.Lines.Select(l =>
                    {
                        var disc    = Math.Clamp(l.DiscountPercent, 0m, 100m);
                        var unitNet = l.UnitPrice * ((100m - disc) / 100m);
                        var tRate   = l.TaxId.HasValue ? (taxes.FirstOrDefault(t => t.Id == l.TaxId.Value)?.Rate ?? 0m) : 0m;
                        return new StockEntryLine
                        {
                            ProductId      = l.ProductId,
                            WarehouseId    = receipt.WarehouseId,
                            Quantity       = l.Quantity,
                            UnitCost       = unitNet,
                            TaxRate        = tRate,
                            BatchNumber    = l.BatchNumber,
                            ExpirationDate = l.ExpirationDate,
                            SerialNumbers  = l.SerialNumbers,
                        };
                    }).ToList()
                };

                await ApplyStockEntry(entry);

                // ── Factura del proveedor (si se informó) ────────────────────────
                APInvoice? ap = null;
                if (!string.IsNullOrWhiteSpace(dto.InvoiceNumber))
                {
                    receipt.IsInvoiced        = true;
                    receipt.InvoicedAt        = DateTime.UtcNow;
                    receipt.InvoiceNumber     = dto.InvoiceNumber.Trim();
                    receipt.InvoiceDate       = (dto.InvoiceDate ?? receiptDate).Date;
                    receipt.InvoiceDueDate    = dto.InvoiceDueDate?.Date;
                    receipt.InvoiceTotal      = receipt.Total;
                    receipt.InvoiceIsCredit   = dto.IsCredit;
                    receipt.InvoiceCreditTermId = dto.CreditTermId;
                    receipt.UpdatedAt         = DateTime.UtcNow;
                    await _ctx.SaveChangesAsync();

                    ap = await UpsertApInvoiceForReceipt(receipt);
                    await _ctx.SaveChangesAsync();
                }

                await trx.CommitAsync();

                if (ap != null)
                    try { await _accounting.PostAPInvoiceAsync(ap.Id); } catch { }

                return Ok(new { receiptId = receipt.Id, receipt.DocNumber, stockEntry = entry.DocumentNumber });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error en recepción directa: {ex.Message}");
            }
        }



    }
}
