using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Pdf;
using Mega7.API.Services;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PurchaseOrdersController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public PurchaseOrdersController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // GET: api/purchaseorders
        [RequirePermission(Perms.PurchaseOrdersView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.PurchaseOrders
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/purchaseorders/5
        [RequirePermission(Perms.PurchaseOrdersView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var doc = await _ctx.PurchaseOrders
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .Include(x => x.Lines)
                    .ThenInclude(l => l.Product)
                .Include(x => x.Lines)
                    .ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();
            return Ok(doc);
        }

        // GET: api/purchaseorders/open
        [RequirePermission(Perms.PurchaseOrdersView)]
        [HttpGet("open")]
        public async Task<IActionResult> GetOpen()
        {
            var list = await _ctx.PurchaseOrders
                .Where(x => x.Status == "OPEN")
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/purchaseorders/{id}/pending
        [RequirePermission(Perms.PurchaseOrdersView)]
        [HttpGet("{id}/pending")]
        public async Task<IActionResult> GetPending(int id)
        {
            var doc = await _ctx.PurchaseOrders
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .Include(x => x.Lines)
                    .ThenInclude(l => l.Product)
                .Include(x => x.Lines)
                    .ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            if (doc.Status != "OPEN")
                return BadRequest("La OC no está en estado OPEN.");

            var pendingLines = doc.Lines
                .Select(l => new
                {
                    l.Id,
                    l.ProductId,
                    l.ProductCode,
                    l.ProductName,

                    OrderedQty = l.Quantity,
                    ReceivedQty = l.ReceivedQuantity,
                    PendingQty = (l.Quantity - l.ReceivedQuantity),

                    l.UnitPrice,
                    l.DiscountPercent,
                    l.TaxId,
                    TaxRate = l.Tax != null ? l.Tax.Rate : 0m,

                    l.LineSubTotal,
                    l.LineTax,
                    l.LineTotal
                })
                .Where(x => x.PendingQty > 0)
                .ToList();

            return Ok(new
            {
                doc.Id,
                doc.DocNumber,
                doc.OrderDate,
                doc.Status,
                doc.SupplierId,
                doc.SupplierName,
                WarehouseId = doc.WarehouseId,
                WarehouseName = doc.Warehouse != null ? doc.Warehouse.Name : null,
                doc.Comments,
                doc.SubTotal,
                doc.TaxTotal,
                doc.Total,
                Lines = pendingLines
            });
        }



        // POST: api/purchaseorders
        [RequirePermission(Perms.PurchaseOrdersCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(PurchaseOrderCreateDto dto)
        {
            var orderDate = dto.OrderDate == default ? DateTime.UtcNow : dto.OrderDate;
            if (!await _periods.HasOpenPeriodForDate(orderDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la orden de compra.");

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest("No se puede crear una OC sin líneas.");

            var supplier = await _ctx.SociosNegocio.FirstOrDefaultAsync(s => s.Id == dto.SupplierId);
            if (supplier == null) return BadRequest("Proveedor no existe.");

            if (supplier.PartnerType != "S")
                return BadRequest("El socio seleccionado no es Proveedor (PartnerType = 'S').");

            var wh = await _ctx.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId);
            if (wh == null) return BadRequest("Depósito no existe.");

            // Validaciones básicas de líneas
            if (dto.Lines.Any(l => l.Quantity <= 0)) return BadRequest("Cantidad debe ser > 0.");
            if (dto.Lines.Any(l => l.UnitPrice < 0)) return BadRequest("Precio no puede ser negativo.");
            if (dto.Lines.Any(l => l.DiscountPercent < 0 || l.DiscountPercent > 100)) return BadRequest("Descuento inválido.");

            // Cargar productos involucrados para snapshots y cálculos
            var productIds = dto.Lines.Select(x => x.ProductId).Distinct().ToList();
            var products = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Count)
                return BadRequest("Uno o más productos no existen.");

            // (Opcional) impuestos
            var taxIds = dto.Lines.Where(x => x.TaxId.HasValue).Select(x => x.TaxId!.Value).Distinct().ToList();
            var taxes = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

            var doc = new PurchaseOrder
            {
                DocNumber = await GenerateNextDocNumber(),
                OrderDate = orderDate,
                SupplierId = supplier.Id,
                SupplierName = supplier.RazonSocial,
                WarehouseId = wh.Id,
                Status = "DRAFT",
                Comments = dto.Comments
            };

            // Build líneas + calcular totales server-side
            foreach (var l in dto.Lines)
            {
                var p = products.First(x => x.Id == l.ProductId);
                var tax = l.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == l.TaxId.Value) : null;

                var discountFactor = (100m - l.DiscountPercent) / 100m;
                var sub = Math.Round(l.Quantity * l.UnitPrice * discountFactor, 2);

                // ✅ REEMPLAZO: usar Tax.Rate directamente
                var taxRate = tax?.Rate ?? 0m;
                var taxAmt = Math.Round(sub * (taxRate / 100m), 2);
                var total = sub + taxAmt;

                doc.Lines.Add(new PurchaseOrderLine
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    Quantity = l.Quantity,
                    UnitPrice = l.UnitPrice,
                    DiscountPercent = l.DiscountPercent,
                    TaxId = l.TaxId,
                    LineSubTotal = sub,
                    LineTax = taxAmt,
                    LineTotal = total
                });
            }

            doc.SubTotal = doc.Lines.Sum(x => x.LineSubTotal);
            doc.TaxTotal = doc.Lines.Sum(x => x.LineTax);
            doc.Total = doc.Lines.Sum(x => x.LineTotal);

            _ctx.PurchaseOrders.Add(doc);
            await _ctx.SaveChangesAsync();

            return Ok(doc);
        }

        // PUT: api/purchaseorders/5
        [RequirePermission(Perms.PurchaseOrdersEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, PurchaseOrderUpdateDto dto)
        {
            
            var doc = await _ctx.PurchaseOrders
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == id);

            var newDate = dto.OrderDate == default ? doc.OrderDate : dto.OrderDate;
            if (!await _periods.HasOpenPeriodForDate(newDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la orden de compra.");

            if (doc == null) return NotFound();

            // Regla: solo se edita si está DRAFT
            if (doc.Status != "DRAFT")
                return BadRequest("Solo se puede editar una OC en estado DRAFT.");

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest("No se puede dejar la OC sin líneas.");

            var supplier = await _ctx.SociosNegocio.FirstOrDefaultAsync(s => s.Id == dto.SupplierId);
            if (supplier == null) return BadRequest("Proveedor no existe.");
            if (supplier.PartnerType != "S")
                return BadRequest("El socio seleccionado no es Proveedor.");

            var wh = await _ctx.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId);
            if (wh == null) return BadRequest("Depósito no existe.");

            // Validaciones
            if (dto.Lines.Any(l => l.Quantity <= 0)) return BadRequest("Cantidad debe ser > 0.");
            if (dto.Lines.Any(l => l.UnitPrice < 0)) return BadRequest("Precio no puede ser negativo.");
            if (dto.Lines.Any(l => l.DiscountPercent < 0 || l.DiscountPercent > 100)) return BadRequest("Descuento inválido.");

            var productIds = dto.Lines.Select(x => x.ProductId).Distinct().ToList();
            var products = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Count) return BadRequest("Uno o más productos no existen.");

            var taxIds = dto.Lines.Where(x => x.TaxId.HasValue).Select(x => x.TaxId!.Value).Distinct().ToList();
            var taxes = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

            // Update cabecera
            doc.OrderDate = newDate;
            doc.SupplierId = supplier.Id;
            doc.SupplierName = supplier.RazonSocial;
            doc.WarehouseId = wh.Id;
            doc.Comments = dto.Comments;
            doc.UpdatedAt = DateTime.UtcNow;

            // Reemplazar líneas
            _ctx.PurchaseOrderLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();

            foreach (var l in dto.Lines)
            {
                var p = products.First(x => x.Id == l.ProductId);
                var tax = l.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == l.TaxId.Value) : null;

                var discountFactor = (100m - l.DiscountPercent) / 100m;
                var sub = Math.Round(l.Quantity * l.UnitPrice * discountFactor, 2);

                // ✅ REEMPLAZO: usar Tax.Rate directamente
                var taxRate = tax?.Rate ?? 0m;
                var taxAmt = Math.Round(sub * (taxRate / 100m), 2);
                var total = sub + taxAmt;

                doc.Lines.Add(new PurchaseOrderLine
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    Quantity = l.Quantity,
                    UnitPrice = l.UnitPrice,
                    DiscountPercent = l.DiscountPercent,
                    TaxId = l.TaxId,
                    LineSubTotal = sub,
                    LineTax = taxAmt,
                    LineTotal = total
                });
            }

            doc.SubTotal = doc.Lines.Sum(x => x.LineSubTotal);
            doc.TaxTotal = doc.Lines.Sum(x => x.LineTax);
            doc.Total = doc.Lines.Sum(x => x.LineTotal);

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/purchaseorders/5/open
        [RequirePermission(Perms.PurchaseOrdersEdit)]
        [HttpPost("{id}/open")]
        public async Task<IActionResult> Open(int id)
        {
            
            var doc = await _ctx.PurchaseOrders.FindAsync(id);
            if (!await _periods.HasOpenPeriodForDate(doc.OrderDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la orden de compra.");
            if (doc == null) return NotFound();
            if (doc.Status != "DRAFT") return BadRequest("Solo se puede abrir desde DRAFT.");

            doc.Status = "OPEN";
            doc.UpdatedAt = DateTime.UtcNow;
            await _ctx.SaveChangesAsync();
            return Ok(doc);
        }

        // POST: api/purchaseorders/5/close
        [RequirePermission(Perms.PurchaseOrdersEdit)]
        [HttpPost("{id}/close")]
        public async Task<IActionResult> Close(int id)
        {
            var doc = await _ctx.PurchaseOrders.FindAsync(id);
            if (doc == null) return NotFound();
            if (doc.Status != "OPEN") return BadRequest("Solo se puede cerrar desde OPEN.");

            doc.Status = "CLOSED";
            doc.UpdatedAt = DateTime.UtcNow;
            await _ctx.SaveChangesAsync();
            return Ok(doc);
        }

        // POST: api/purchaseorders/5/cancel
        [RequirePermission(Perms.PurchaseOrdersCancel)]
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            var doc = await _ctx.PurchaseOrders.FindAsync(id);
            if (doc == null) return NotFound();
            if (doc.Status == "CLOSED") return BadRequest("No se puede cancelar una OC cerrada.");

            doc.Status = "CANCELED";
            doc.UpdatedAt = DateTime.UtcNow;
            await _ctx.SaveChangesAsync();
            return Ok(doc);
        }

        // ----------------------------------------------------
        // Generador simple de numeración (por ahora)
        // Luego lo convertimos en Series por tipo/doc/año
        // ----------------------------------------------------
        private async Task<string> GenerateNextDocNumber()
        {
            // OC000001
            var last = await _ctx.PurchaseOrders
                .OrderByDescending(x => x.Id)
                .Select(x => x.DocNumber)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(last))
                return "OC000001";

            var numPart = new string(last.Where(char.IsDigit).ToArray());
            if (!int.TryParse(numPart, out var n)) n = 0;

            n++;
            return $"OC{n:D6}";
        }

        [RequirePermission(Perms.PurchaseOrdersView)]
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> Pdf(int id, [FromServices] IWebHostEnvironment env)
        {
            var doc = await _ctx.PurchaseOrders
                .Include(x => x.Supplier)
                .Include(x => x.Warehouse)
                .Include(x => x.Lines).ThenInclude(l => l.Product)
                .Include(x => x.Lines).ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            var logoPath = Path.Combine(env.WebRootPath, "images", "mega7_logo.png");

            var pdfBytes = new PurchaseOrderPdf(doc, logoPath).GeneratePdf();
            return File(pdfBytes, "application/pdf", $"{doc.DocNumber}.pdf");
        }
    }
}
