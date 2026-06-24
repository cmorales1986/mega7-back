using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class StockTransferController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public StockTransferController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // GET: api/StockTransfer
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.StockTransfers
                .AsNoTracking()
                .Include(t => t.FromWarehouse)
                .Include(t => t.ToWarehouse)
                .Include(t => t.Lines)
                    .ThenInclude(l => l.Product)
                .OrderByDescending(t => t.TransferDate)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/StockTransfer/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var doc = await _ctx.StockTransfers
                .AsNoTracking()
                .Include(t => t.FromWarehouse)
                .Include(t => t.ToWarehouse)
                .Include(t => t.Lines)
                    .ThenInclude(l => l.Product)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (doc == null) return NotFound();
            return Ok(doc);
        }

        private static decimal WeightedAvg(decimal oldQty, decimal oldCost, decimal inQty, decimal inCost)
        {
            var newQty = oldQty + inQty;
            if (newQty <= 0) return 0m;
            return ((oldQty * oldCost) + (inQty * inCost)) / newQty;
        }

        [HttpPost]
        public async Task<IActionResult> CreateTransfer(StockTransfer transfer)
        {
            if (!await _periods.HasOpenPeriodForDate(transfer.TransferDate))
                return BadRequest("No existe un período ABIERTO para la fecha del traslado.");
            if (transfer.Lines == null || !transfer.Lines.Any())
                return BadRequest("No se puede crear un traslado sin líneas.");

            if (transfer.FromWarehouseId == transfer.ToWarehouseId)
                return BadRequest("Los depósitos origen y destino no pueden ser iguales.");

            // 🔴 IMPORTANTÍSIMO: evitar que EF inserte líneas junto con la cabecera
            var lines = transfer.Lines.ToList();
            transfer.Lines = new List<StockTransferLine>();

            // sano: evitar identity insert si el front manda Id
            transfer.Id = 0;

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                // 1) Guardar cabecera sola
                _ctx.StockTransfers.Add(transfer);
                await _ctx.SaveChangesAsync(); // ya tenemos transfer.Id

                // 2) Procesar líneas
                foreach (var line in lines)
                {
                    line.Id = 0;
                    line.StockTransferId = transfer.Id;

                    line.FromWarehouseId = transfer.FromWarehouseId;
                    line.ToWarehouseId = transfer.ToWarehouseId;

                    var product = await _ctx.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId);
                    if (product == null)
                        return BadRequest($"Producto no encontrado (ID {line.ProductId})");

                    // ========================================
                    // STOCK ORIGEN
                    // ========================================
                    var stockFrom = await _ctx.Stocks.FirstOrDefaultAsync(s =>
                        s.ProductId == line.ProductId &&
                        s.WarehouseId == transfer.FromWarehouseId);

                    if (stockFrom == null || stockFrom.Quantity < line.Quantity)
                        return BadRequest($"Stock insuficiente del producto {product.Name} en el depósito origen.");

                    // ========================================
                    // STOCK DESTINO
                    // ========================================
                    var stockTo = await _ctx.Stocks.FirstOrDefaultAsync(s =>
                        s.ProductId == line.ProductId &&
                        s.WarehouseId == transfer.ToWarehouseId);

                    if (stockTo == null)
                    {
                        stockTo = new Stock
                        {
                            ProductId = line.ProductId,
                            WarehouseId = transfer.ToWarehouseId,
                            Quantity = 0m,
                            AvgCost = 0m
                        };
                        _ctx.Stocks.Add(stockTo);
                    }

                    // ========================================
                    // ✅ COSTO A MOVER
                    // ========================================
                    decimal unitCostMoved = 0m;

                    // ========================================
                    // LOTES
                    // ========================================
                    if (product.IsBatchManaged)
                    {
                        if (string.IsNullOrWhiteSpace(line.BatchNumber))
                            return BadRequest($"El producto {product.Name} requiere lote.");

                        var batchFrom = await _ctx.Batches.FirstOrDefaultAsync(b =>
                            b.ProductId == line.ProductId &&
                            b.WarehouseId == transfer.FromWarehouseId &&
                            b.BatchNumber == line.BatchNumber);

                        if (batchFrom == null)
                            return BadRequest($"El lote {line.BatchNumber} no existe en el depósito origen.");

                        if (batchFrom.Quantity < line.Quantity)
                            return BadRequest($"Stock insuficiente en el lote {line.BatchNumber}.");

                        unitCostMoved = batchFrom.UnitCost; // ✅ costo lote

                        batchFrom.Quantity -= line.Quantity;
                        batchFrom.UpdatedAt = DateTime.UtcNow;

                        var batchTo = await _ctx.Batches.FirstOrDefaultAsync(b =>
                            b.ProductId == line.ProductId &&
                            b.WarehouseId == transfer.ToWarehouseId &&
                            b.BatchNumber == line.BatchNumber);

                        if (batchTo == null)
                        {
                            batchTo = new Batch
                            {
                                ProductId = line.ProductId,
                                WarehouseId = transfer.ToWarehouseId,
                                BatchNumber = line.BatchNumber!,
                                ExpirationDate = batchFrom.ExpirationDate,
                                Quantity = 0m,
                                UnitCost = batchFrom.UnitCost, // ✅ copiar costo
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow
                            };
                            _ctx.Batches.Add(batchTo);
                        }
                        else
                        {
                            // si ya existe ese lote en destino, debería tener mismo costo.
                            // por seguridad lo dejamos igual al origen (o podrías ponderar si permitís mezclas).
                            batchTo.UnitCost = batchFrom.UnitCost;
                        }

                        batchTo.Quantity += line.Quantity;
                        batchTo.UpdatedAt = DateTime.UtcNow;
                    }

                    // ========================================
                    // SERIALES
                    // ========================================
                    if (product.IsSerialManaged)
                    {
                        if (string.IsNullOrWhiteSpace(line.SerialNumbers))
                            return BadRequest($"Debe especificar seriales para {product.Name}.");

                        var serialList = line.SerialNumbers
                            .Split(new[] { ",", ";", "\n", "\r" }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim())
                            .Where(x => x.Length > 0)
                            .Distinct()
                            .ToList();

                        if (serialList.Count != (int)line.Quantity)
                            return BadRequest($"Cantidad ({line.Quantity}) no coincide con seriales enviados ({serialList.Count}) para {product.Name}.");

                        decimal totalSerialCost = 0m;

                        foreach (var sn in serialList)
                        {
                            var serial = await _ctx.Serials.FirstOrDefaultAsync(s =>
                                s.ProductId == line.ProductId &&
                                s.WarehouseId == transfer.FromWarehouseId &&
                                s.SerialNumber == sn &&
                                s.IsActive == true);

                            if (serial == null)
                                return BadRequest($"El serial {sn} no está disponible en el depósito origen.");

                            totalSerialCost += serial.UnitCost; // ✅ costo del serial
                            serial.WarehouseId = transfer.ToWarehouseId; // mover
                            serial.UpdatedAt = DateTime.UtcNow;
                        }

                        unitCostMoved = serialList.Count == 0 ? 0m : (totalSerialCost / serialList.Count);
                    }

                    // ========================================
                    // NORMAL (promedio en origen)
                    // ========================================
                    if (!product.IsBatchManaged && !product.IsSerialManaged)
                    {
                        unitCostMoved = stockFrom.AvgCost; // ✅ costo que “viaja”
                    }

                    // Auditoría
                    line.UnitCostMoved = unitCostMoved;
                    line.LineCost = Math.Round(line.Quantity * unitCostMoved, 2);

                    // ========================================
                    // STOCK GENERAL: mover cantidades
                    // ========================================
                    stockFrom.Quantity -= line.Quantity;
                    if (stockFrom.Quantity <= 0) stockFrom.Quantity = 0;

                    var oldToQty = stockTo.Quantity;
                    var oldToAvg = stockTo.AvgCost;

                    stockTo.Quantity += line.Quantity;

                    // ✅ Recalcular promedio SOLO para productos normales
                    if (!product.IsBatchManaged && !product.IsSerialManaged)
                    {
                        stockTo.AvgCost = WeightedAvg(oldToQty, oldToAvg, line.Quantity, unitCostMoved);
                        if (stockTo.Quantity <= 0) stockTo.AvgCost = 0m;
                    }

                    // Guardar línea
                    _ctx.StockTransferLines.Add(line);
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                var saved = await _ctx.StockTransfers
                    .Include(t => t.Lines)
                    .FirstAsync(t => t.Id == transfer.Id);

                return Ok(saved);
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error al procesar el traslado: {ex.Message}");
            }
        }
    }
}
