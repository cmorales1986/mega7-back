using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class StockController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public StockController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // =====================================================
        // 1) Stock general por producto
        // GET: api/stock/product/5
        // =====================================================
        [RequirePermission(Perms.StockView)]
        [HttpGet("product/{productId}")]
        public async Task<IActionResult> GetStockByProduct(int productId)
        {
            var stockList = await _ctx.Stocks
                .Where(s => s.ProductId == productId)
                .Include(s => s.Warehouse)
                .ToListAsync();

            return Ok(stockList);
        }

        // =====================================================
        // 2) Lotes del producto
        // GET: api/stock/batches/5
        // =====================================================
        [RequirePermission(Perms.StockView)]
        [HttpGet("batches/{productId}")]
        public async Task<IActionResult> GetBatches(int productId)
        {
            var batches = await _ctx.Batches
                .Where(b => b.ProductId == productId)
                .Include(b => b.Warehouse)
                .ToListAsync();

            return Ok(batches);
        }

        // =====================================================
        // 3) Seriales disponibles del producto
        // GET: api/stock/serials/5
        // =====================================================
        [RequirePermission(Perms.StockView)]
        [HttpGet("serials/{productId}")]
        public async Task<IActionResult> GetSerials(int productId)
        {
            var serials = await _ctx.Serials
                .Where(s => s.ProductId == productId && s.IsActive == true)
                .Include(s => s.Warehouse)
                .ToListAsync();

            return Ok(serials);
        }

        // =====================================================
        // ✅ 4) STOCK VALORIZADO (por depósito opcional)
        // GET: api/stock/valuation?warehouseId=1
        // - Normal: qty * AvgCost
        // - Lote: sum(batch.qty * batch.unitCost)
        // - Serial: sum(serial.unitCost) (qty = count)
        // =====================================================
        [RequirePermission(Perms.StockView)]
        [HttpGet("valuation")]
        public async Task<IActionResult> GetValuation([FromQuery] int? warehouseId = null)
        {
            // 1) base: stocks + producto + depósito
            var stocks = await _ctx.Stocks
                .AsNoTracking()
                .Where(s => warehouseId == null || s.WarehouseId == warehouseId.Value)
                .Include(s => s.Product)
                .Include(s => s.Warehouse)
                .ToListAsync();

            if (stocks.Count == 0)
                return Ok(new List<object>());

            var productIds = stocks.Select(s => s.ProductId).Distinct().ToList();
            var whIds = stocks.Select(s => s.WarehouseId).Distinct().ToList();

            // 2) lotes: valor por (productId, warehouseId)
            var batchAgg = await _ctx.Batches
                .AsNoTracking()
                .Where(b => productIds.Contains(b.ProductId) && whIds.Contains(b.WarehouseId))
                .GroupBy(b => new { b.ProductId, b.WarehouseId })
                .Select(g => new
                {
                    g.Key.ProductId,
                    g.Key.WarehouseId,
                    Qty = g.Sum(x => x.Quantity),
                    Value = g.Sum(x => x.Quantity * x.UnitCost)
                })
                .ToListAsync();

            var batchMap = batchAgg.ToDictionary(
                x => $"{x.ProductId}-{x.WarehouseId}",
                x => new { x.Qty, x.Value }
            );

            // 3) seriales activos: valor por (productId, warehouseId)
            var serialAgg = await _ctx.Serials
                .AsNoTracking()
                .Where(s => s.IsActive == true && productIds.Contains(s.ProductId) && whIds.Contains(s.WarehouseId))
                .GroupBy(s => new { s.ProductId, s.WarehouseId })
                .Select(g => new
                {
                    g.Key.ProductId,
                    g.Key.WarehouseId,
                    Qty = g.Count(),
                    Value = g.Sum(x => x.UnitCost)
                })
                .ToListAsync();

            var serialMap = serialAgg.ToDictionary(
                x => $"{x.ProductId}-{x.WarehouseId}",
                x => new { Qty = (decimal)x.Qty, x.Value }
            );

            // 4) armar respuesta
            var result = stocks
                .Select(s =>
                {
                    var p = s.Product;
                    var w = s.Warehouse;

                    var key = $"{s.ProductId}-{s.WarehouseId}";

                    var isBatch = p?.IsBatchManaged ?? false;
                    var isSerial = p?.IsSerialManaged ?? false;

                    decimal qty;
                    decimal value;
                    string method;

                    if (isSerial)
                    {
                        method = "SERIAL";
                        if (serialMap.TryGetValue(key, out var ser))
                        {
                            qty = ser.Qty;
                            value = ser.Value;
                        }
                        else
                        {
                            qty = 0m;
                            value = 0m;
                        }
                    }
                    else if (isBatch)
                    {
                        method = "BATCH";
                        if (batchMap.TryGetValue(key, out var bat))
                        {
                            qty = bat.Qty;
                            value = bat.Value;
                        }
                        else
                        {
                            qty = 0m;
                            value = 0m;
                        }
                    }
                    else
                    {
                        method = "AVG";
                        qty = s.Quantity;
                        value = s.Quantity * s.AvgCost;
                    }

                    var avgShown = qty > 0 ? (value / qty) : 0m;

                    return new
                    {
                        WarehouseId = s.WarehouseId,
                        WarehouseName = w?.Name ?? "",

                        ProductId = s.ProductId,
                        ProductCode = p?.Code ?? "",
                        ProductName = p?.Name ?? "",

                        CostMethod = method,
                        Qty = qty,
                        AvgCost = Math.Round(avgShown, 6),
                        StockValue = Math.Round(value, 2)
                    };
                })
                .OrderBy(x => x.WarehouseName)
                .ThenBy(x => x.ProductName)
                .ToList();

            return Ok(result);
        }

        // =====================================================
        // 5) KARDEX – movimientos del producto
        // GET: api/stock/kardex/5
        // (lo dejamos como estaba; si querés lo valorizamos después)
        // =====================================================
        [RequirePermission(Perms.StockView)]
        [HttpGet("kardex/{productId}")]
        public async Task<IActionResult> GetKardex(int productId)
        {
            var entradas = await _ctx.StockEntryLines
                .Where(l => l.ProductId == productId)
                .Select(l => new
                {
                    Fecha = l.StockEntry.EntryDate,
                    Tipo = "ENTRADA",
                    Documento = l.StockEntry.DocumentNumber,
                    Cantidad = l.Quantity,
                    Deposito = l.Warehouse.Name
                })
                .ToListAsync();

            var salidas = await _ctx.StockOutputLines
                .Where(l => l.ProductId == productId)
                .Select(l => new
                {
                    Fecha = l.StockOutput.OutputDate,
                    Tipo = "SALIDA",
                    Documento = l.StockOutput.DocumentNumber,
                    Cantidad = -l.Quantity,
                    Deposito = l.Warehouse.Name
                })
                .ToListAsync();

            var transferOut = await _ctx.StockTransferLines
                .Where(l => l.ProductId == productId)
                .Select(l => new
                {
                    Fecha = l.StockTransfer.TransferDate,
                    Tipo = "TRASLADO SALIDA",
                    Documento = l.StockTransfer.Id.ToString(),
                    Cantidad = -l.Quantity,
                    Deposito = _ctx.Warehouses.First(w => w.Id == l.FromWarehouseId).Name
                })
                .ToListAsync();

            var transferIn = await _ctx.StockTransferLines
                .Where(l => l.ProductId == productId)
                .Select(l => new
                {
                    Fecha = l.StockTransfer.TransferDate,
                    Tipo = "TRASLADO ENTRADA",
                    Documento = l.StockTransfer.Id.ToString(),
                    Cantidad = l.Quantity,
                    Deposito = _ctx.Warehouses.First(w => w.Id == l.ToWarehouseId).Name
                })
                .ToListAsync();

            var movimientos = entradas
                .Concat(salidas)
                .Concat(transferOut)
                .Concat(transferIn)
                .OrderBy(m => m.Fecha)
                .ToList();

            return Ok(movimientos);
        }
    }
}
