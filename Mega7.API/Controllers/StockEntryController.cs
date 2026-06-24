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
    public class StockEntryController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public StockEntryController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        [RequirePermission(Perms.StockEntryView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.StockEntries
                .AsNoTracking()
                .OrderByDescending(x => x.EntryDate)
                .Select(x => new StockEntryListDto
                {
                    Id = x.Id,
                    EntryDate = x.EntryDate,
                    DocumentType = x.DocumentType,
                    DocumentNumber = x.DocumentNumber,
                    EntryMode = x.EntryMode,
                    SupplierName = x.SupplierName,
                    DocumentRef = x.DocumentRef,

                    WarehouseId = x.WarehouseId,
                    WarehouseName = x.Warehouse != null ? x.Warehouse.Name : "",

                    LinesCount = x.Lines != null ? x.Lines.Count : 0,
                    QtyTotal = x.Lines != null ? x.Lines.Sum(l => l.Quantity) : 0,
                    Total = x.Lines != null ? x.Lines.Sum(l => l.Quantity * l.UnitCost) : 0
                })
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.StockEntryView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var entry = await _ctx.StockEntries
                .AsNoTracking()
                .Include(x => x.Warehouse)
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (entry == null) return NotFound();

            if (entry.Lines != null)
                foreach (var l in entry.Lines)
                    l.StockEntry = null;

            entry.Warehouse = null;
            return Ok(entry);
        }

        private static decimal WeightedAvg(decimal oldQty, decimal oldCost, decimal inQty, decimal inCost)
        {
            var newQty = oldQty + inQty;
            if (newQty <= 0) return 0m;
            return ((oldQty * oldCost) + (inQty * inCost)) / newQty;
        }

        [RequirePermission(Perms.StockEntryCreate)]
        [HttpPost]
        public async Task<IActionResult> CreateEntry(StockEntry entry)
        {
            if (!await _periods.HasOpenPeriodForDate(entry.EntryDate))
                return BadRequest("No existe un período ABIERTO para la fecha del ingreso.");
            if (entry.Lines == null || entry.Lines.Count == 0)
                return BadRequest("No se puede crear un ingreso sin líneas.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                // normalizar modo
                entry.EntryMode = (entry.EntryMode ?? "ADD").Trim().ToUpperInvariant();
                if (entry.EntryMode != "ADD" && entry.EntryMode != "SET")
                    return BadRequest("EntryMode inválido. Use ADD o SET.");

                // ✅ separar líneas para que EF NO intente insertarlas junto con cabecera
                var lines = entry.Lines.ToList();
                entry.Lines = new List<StockEntryLine>();

                entry.Id = 0;

                _ctx.StockEntries.Add(entry);
                await _ctx.SaveChangesAsync(); // ya tenemos entry.Id

                // ✅ si es SET, limpiamos por producto+depósito UNA sola vez
                var cleared = new HashSet<string>();

                foreach (var line in lines)
                {
                    if (line.Quantity <= 0)
                        return BadRequest("Quantity debe ser mayor a 0.");
                    if (line.UnitCost < 0)
                        return BadRequest("UnitCost no puede ser negativo.");

                    line.Id = 0;
                    line.StockEntryId = entry.Id;
                    line.StockEntry = null;

                    var product = await _ctx.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId);
                    if (product == null)
                        return BadRequest($"Producto no encontrado (ID {line.ProductId})");

                    if (product.IsBatchManaged && product.IsSerialManaged)
                        return BadRequest("El producto no puede ser loteable y serializable al mismo tiempo.");

                    // ✅ limpiar si modo SET
                    if (entry.EntryMode == "SET")
                    {
                        var key = $"{line.ProductId}-{line.WarehouseId}";
                        if (!cleared.Contains(key))
                        {
                            var stockRow = await _ctx.Stocks
                                .FirstOrDefaultAsync(s => s.ProductId == line.ProductId && s.WarehouseId == line.WarehouseId);

                            if (stockRow != null) _ctx.Stocks.Remove(stockRow);

                            var batches = await _ctx.Batches
                                .Where(b => b.ProductId == line.ProductId && b.WarehouseId == line.WarehouseId)
                                .ToListAsync();
                            if (batches.Count > 0) _ctx.Batches.RemoveRange(batches);

                            var serials = await _ctx.Serials
                                .Where(s => s.ProductId == line.ProductId && s.WarehouseId == line.WarehouseId)
                                .ToListAsync();
                            if (serials.Count > 0) _ctx.Serials.RemoveRange(serials);

                            cleared.Add(key);
                            await _ctx.SaveChangesAsync(); // asegura limpieza antes de recrear
                        }
                    }

                    // =========================
                    // 1) STOCK GENERAL (qty + avg)
                    // =========================
                    var stock = await _ctx.Stocks
                        .FirstOrDefaultAsync(s => s.ProductId == line.ProductId && s.WarehouseId == line.WarehouseId);

                    if (stock == null)
                    {
                        stock = new Stock
                        {
                            ProductId = line.ProductId,
                            WarehouseId = line.WarehouseId,
                            Quantity = 0m,
                            AvgCost = 0m
                        };
                        _ctx.Stocks.Add(stock);
                    }

                    var oldQty = stock.Quantity;
                    var oldAvg = stock.AvgCost;

                    stock.Quantity += line.Quantity;

                    // ✅ promedio SOLO si NO es lote/serial
                    if (!product.IsBatchManaged && !product.IsSerialManaged)
                    {
                        stock.AvgCost = WeightedAvg(oldQty, oldAvg, line.Quantity, line.UnitCost);
                        if (stock.Quantity <= 0) stock.AvgCost = 0m;
                    }

                    // =========================
                    // 2) LOTES (qty + unitcost)
                    // =========================
                    if (product.IsBatchManaged)
                    {
                        line.BatchNumber = line.BatchNumber?.Trim();

                        if (string.IsNullOrWhiteSpace(line.BatchNumber))
                            return BadRequest("El producto es loteable. Debe especificar BatchNumber.");

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
                                Quantity = 0m,
                                UnitCost = line.UnitCost, // ✅ costo inicial del lote
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow
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

                    // =========================
                    // 3) SERIALES (guardar costo)
                    // =========================
                    if (product.IsSerialManaged)
                    {
                        if (string.IsNullOrWhiteSpace(line.SerialNumbers))
                            return BadRequest("Debe enviar SerialNumbers para productos serializables.");

                        var serialList = line.SerialNumbers
                            .Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim())
                            .Where(x => !string.IsNullOrWhiteSpace(x))
                            .Distinct()
                            .ToList();

                        if (serialList.Count != (int)line.Quantity)
                            return BadRequest($"Cantidad de seriales ({serialList.Count}) debe coincidir con Quantity ({line.Quantity}).");

                        foreach (var sn in serialList)
                        {
                            var exists = await _ctx.Serials.AnyAsync(s =>
                                s.ProductId == product.Id &&
                                s.WarehouseId == line.WarehouseId &&
                                s.SerialNumber == sn);

                            if (exists)
                                return BadRequest($"El serial {sn} ya existe en este depósito para este producto.");

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

                    // ✅ insertar línea (una sola vez)
                    _ctx.StockEntryLines.Add(line);
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { entry.Id });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error en ingreso: {ex.Message}");
            }
        }
    }
}
