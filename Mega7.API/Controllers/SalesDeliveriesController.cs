using Mega7.API.Attributes;
using Mega7.API.Data;
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
    public class SalesDeliveriesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public SalesDeliveriesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/salesdeliveries
        [RequirePermission(Perms.SalesDeliveriesView)]
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] bool includeCancelled = false,
            [FromQuery] bool? invoiced = null)
        {
            var q = _ctx.SalesDeliveries
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .AsQueryable();

            if (!includeCancelled)
                q = q.Where(x => !x.IsCancelled);

            if (invoiced.HasValue)
                q = q.Where(x => x.IsInvoiced == invoiced.Value);

            var list = await q.Select(x => new
            {
                x.Id,
                x.DocNumber,
                x.DeliveryDate,
                x.CustomerId,
                x.CustomerName,
                x.WarehouseId,
                x.SalesOrderId,
                x.Total,
                x.Status,
                x.IsCancelled,
                x.IsInvoiced,
                x.CreatedAt
            }).ToListAsync();

            return Ok(list);
        }

        // GET: api/salesdeliveries/{id}
        [RequirePermission(Perms.SalesDeliveriesView)]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var doc = await _ctx.SalesDeliveries
                .AsNoTracking()
                .Include(d => d.Lines)
                .Include(d => d.Warehouse)
                .Where(d => d.Id == id)
                .Select(d => new
                {
                    d.Id,
                    d.DocNumber,
                    d.DeliveryDate,
                    d.CustomerId,
                    d.CustomerName,
                    d.WarehouseId,
                    Warehouse = d.Warehouse == null ? null : new { d.Warehouse.Id, d.Warehouse.Name },
                    d.SalesOrderId,
                    d.Total,
                    d.Status,
                    d.IsCancelled,
                    d.CancelledAt,
                    d.CancelReason,
                    d.IsInvoiced,
                    d.InvoicedAt,
                    d.Comments,
                    d.CreatedAt,
                    Lines = d.Lines.Select(l => new
                    {
                        l.Id,
                        l.ProductId,
                        l.ProductCode,
                        l.ProductName,
                        l.Quantity,
                        l.UnitPrice,
                        l.DiscountPercent,
                        l.TaxId,
                        l.BatchNumber,
                        l.SerialNumbers,
                        l.LineTotal,
                        l.SalesOrderLineId
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (doc == null) return NotFound();
            return Ok(doc);
        }

        // POST: api/salesdeliveries
        [RequirePermission(Perms.SalesDeliveriesCreate)]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SalesDeliveryCreateDto dto)
        {
            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest("Debe incluir al menos una línea.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                var deliveryDate = dto.DeliveryDate == default ? DateTime.UtcNow : dto.DeliveryDate;

                string customerName;
                int customerId;
                int warehouseId;
                int? salesOrderId = dto.SalesOrderId;

                // ── Resolver cliente/depósito ──────────────────────────────────
                if (dto.SalesOrderId.HasValue)
                {
                    var so = await _ctx.SalesOrders
                        .AsNoTracking()
                        .Include(x => x.Customer)
                        .FirstOrDefaultAsync(x => x.Id == dto.SalesOrderId.Value);

                    if (so == null) return NotFound("Orden de venta no existe.");
                    if (so.Status != "OPEN") return BadRequest("La OV debe estar en estado OPEN.");

                    customerId   = so.CustomerId;
                    customerName = so.CustomerName;
                    warehouseId  = dto.WarehouseId > 0 ? dto.WarehouseId : so.WarehouseId;
                }
                else
                {
                    if (!dto.CustomerId.HasValue || dto.CustomerId.Value <= 0)
                        return BadRequest("CustomerId es requerido en modo directo.");
                    if (dto.WarehouseId <= 0)
                        return BadRequest("WarehouseId es requerido.");

                    var customer = await _ctx.SociosNegocio.FindAsync(dto.CustomerId.Value);
                    if (customer == null) return NotFound("Cliente no existe.");

                    customerId   = customer.Id;
                    customerName = customer.RazonSocial ?? "";
                    warehouseId  = dto.WarehouseId;
                }

                var warehouse = await _ctx.Warehouses.FindAsync(warehouseId);
                if (warehouse == null) return NotFound("Depósito no existe.");

                // ── Cargar productos y taxes ───────────────────────────────────
                var productIds = dto.Lines.Select(l => l.ProductId).Distinct().ToList();
                var products   = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();

                var taxIds = dto.Lines.Where(l => l.TaxId.HasValue).Select(l => l.TaxId!.Value).Distinct().ToList();
                var taxes  = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

                // ── Procesar líneas: validar y aplicar stock OUT ───────────────
                var delivery = new SalesDelivery
                {
                    DocNumber    = await GenerateNextDocNumber(),
                    DeliveryDate = deliveryDate,
                    SalesOrderId = salesOrderId,
                    CustomerId   = customerId,
                    CustomerName = customerName,
                    WarehouseId  = warehouseId,
                    Status       = "POSTED",
                    Comments     = dto.Comments?.Trim(),
                    CreatedAt    = DateTime.UtcNow
                };

                foreach (var dl in dto.Lines)
                {
                    var product = products.FirstOrDefault(p => p.Id == dl.ProductId);
                    if (product == null)
                        return BadRequest($"Producto {dl.ProductId} no existe.");

                    if (dl.Quantity <= 0)
                        return BadRequest($"Cantidad inválida en {product.Name}.");

                    // Verificar y restar stock
                    var stock = await _ctx.Stocks
                        .FirstOrDefaultAsync(s => s.ProductId == dl.ProductId && s.WarehouseId == warehouseId);

                    if (stock == null || stock.Quantity < dl.Quantity)
                        return BadRequest($"Stock insuficiente para {product.Name}. Disponible: {stock?.Quantity ?? 0}");

                    // Lotes
                    if (product.IsBatchManaged)
                    {
                        if (string.IsNullOrWhiteSpace(dl.BatchNumber))
                            return BadRequest($"{product.Name} requiere lote (BatchNumber).");

                        var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                            b.ProductId == dl.ProductId &&
                            b.WarehouseId == warehouseId &&
                            b.BatchNumber == dl.BatchNumber);

                        if (batch == null)
                            return BadRequest($"Lote {dl.BatchNumber} no existe para {product.Name}.");
                        if (batch.Quantity < dl.Quantity)
                            return BadRequest($"Stock insuficiente en lote {dl.BatchNumber} ({product.Name}).");

                        batch.Quantity -= dl.Quantity;
                        batch.UpdatedAt = DateTime.UtcNow;
                    }

                    // Seriales
                    if (product.IsSerialManaged)
                    {
                        if (string.IsNullOrWhiteSpace(dl.SerialNumbers))
                            return BadRequest($"{product.Name} requiere números de serie.");

                        var serialList = dl.SerialNumbers.Split(',')
                            .Select(s => s.Trim())
                            .Where(s => s.Length > 0)
                            .ToList();

                        if (serialList.Count != (int)dl.Quantity)
                            return BadRequest($"Cantidad de seriales no coincide para {product.Name}.");

                        foreach (var sn in serialList)
                        {
                            var serial = await _ctx.Serials.FirstOrDefaultAsync(s =>
                                s.ProductId == dl.ProductId &&
                                s.WarehouseId == warehouseId &&
                                s.SerialNumber == sn &&
                                s.IsActive);

                            if (serial == null)
                                return BadRequest($"Serial {sn} no disponible en este depósito.");

                            serial.IsActive = false;
                            serial.UpdatedAt = DateTime.UtcNow;
                        }
                    }

                    stock.Quantity -= dl.Quantity;

                    var tax    = dl.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == dl.TaxId.Value) : null;
                    var disc   = (100m - dl.DiscountPercent) / 100m;
                    var subtot = Math.Round(dl.Quantity * dl.UnitPrice * disc, 2);
                    var taxAmt = Math.Round(subtot * ((tax?.Rate ?? 0m) / 100m), 2);

                    delivery.Lines.Add(new SalesDeliveryLine
                    {
                        SalesOrderLineId = dl.SalesOrderLineId,
                        ProductId        = product.Id,
                        ProductCode      = product.Code ?? "",
                        ProductName      = product.Name ?? "",
                        Quantity         = dl.Quantity,
                        UnitPrice        = dl.UnitPrice,
                        DiscountPercent  = dl.DiscountPercent,
                        TaxId            = dl.TaxId,
                        BatchNumber      = dl.BatchNumber?.Trim(),
                        SerialNumbers    = dl.SerialNumbers?.Trim(),
                        LineTotal        = subtot + taxAmt
                    });
                }

                delivery.Total = delivery.Lines.Sum(l => l.LineTotal);

                _ctx.SalesDeliveries.Add(delivery);
                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { deliveryId = delivery.Id, delivery.DocNumber, delivery.Total });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error al crear entrega: {ex.Message}");
            }
        }

        // POST: api/salesdeliveries/{id}/cancel
        [RequirePermission(Perms.SalesDeliveriesCancel)]
        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] ARInvoiceCancelDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                var delivery = await _ctx.SalesDeliveries
                    .Include(d => d.Lines)
                    .FirstOrDefaultAsync(d => d.Id == id);

                if (delivery == null) return NotFound("Entrega no existe.");
                if (delivery.IsCancelled) return Ok(new { ok = true, delivery.Id, delivery.Status });

                // No cancelar si tiene factura activa
                var hasActiveInvoice = await _ctx.ARInvoices.AnyAsync(ar =>
                    ar.SalesDeliveryId == id &&
                    (ar.Status ?? "OPEN").ToUpperInvariant() != "CANCELLED");

                if (hasActiveInvoice)
                    return BadRequest("No se puede anular: la entrega tiene una factura activa. Anule la factura primero.");

                // ── Revertir stock OUT → devolver al stock ─────────────────────
                foreach (var line in delivery.Lines)
                {
                    var stock = await _ctx.Stocks.FirstOrDefaultAsync(s =>
                        s.ProductId == line.ProductId && s.WarehouseId == delivery.WarehouseId);

                    if (stock != null)
                        stock.Quantity += line.Quantity;

                    // Restaurar lote
                    if (!string.IsNullOrWhiteSpace(line.BatchNumber))
                    {
                        var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                            b.ProductId    == line.ProductId &&
                            b.WarehouseId  == delivery.WarehouseId &&
                            b.BatchNumber  == line.BatchNumber);

                        if (batch != null)
                        {
                            batch.Quantity += line.Quantity;
                            batch.UpdatedAt = DateTime.UtcNow;
                        }
                    }

                    // Restaurar seriales
                    if (!string.IsNullOrWhiteSpace(line.SerialNumbers))
                    {
                        var serialList = line.SerialNumbers.Split(',')
                            .Select(s => s.Trim())
                            .Where(s => s.Length > 0)
                            .ToList();

                        foreach (var sn in serialList)
                        {
                            var serial = await _ctx.Serials.FirstOrDefaultAsync(s =>
                                s.ProductId   == line.ProductId &&
                                s.WarehouseId == delivery.WarehouseId &&
                                s.SerialNumber == sn);

                            if (serial != null)
                            {
                                serial.IsActive  = true;
                                serial.UpdatedAt = DateTime.UtcNow;
                            }
                        }
                    }
                }

                delivery.IsCancelled = true;
                delivery.Status      = "CANCELLED";
                delivery.CancelledAt = DateTime.UtcNow;
                delivery.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason)
                    ? "Anulado manualmente."
                    : dto!.Reason!.Trim();
                delivery.UpdatedAt   = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, delivery.Id, delivery.Status, delivery.CancelledAt });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error al anular: {ex.Message}");
            }
        }

        private async Task<string> GenerateNextDocNumber()
        {
            var last = await _ctx.SalesDeliveries
                .OrderByDescending(x => x.Id)
                .Select(x => x.DocNumber)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(last)) return "EV000001";

            var numPart = new string(last.Where(char.IsDigit).ToArray());
            if (!int.TryParse(numPart, out var n)) n = 0;
            n++;
            return $"EV{n:D6}";
        }
    }

}
