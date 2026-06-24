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
    public class StockOutputController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public StockOutputController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.StockOutputs
                .AsNoTracking()
                .OrderByDescending(x => x.OutputDate)
                .Select(x => new StockOutputListDto
                {
                    Id = x.Id,
                    OutputDate = x.OutputDate,
                    DocumentType = x.DocumentType,
                    DocumentNumber = x.DocumentNumber,

                    WarehouseId = x.WarehouseId,
                    WarehouseName = x.Warehouse != null ? x.Warehouse.Name : "",

                    LinesCount = x.Lines != null ? x.Lines.Count : 0,
                    QtyTotal = x.Lines != null ? x.Lines.Sum(l => l.Quantity) : 0
                })
                .ToListAsync();

            return Ok(list);
        }

        // =========================================================
        // GET: api/stockoutput/{id}
        // Detalle (trae líneas, corta ciclos)
        // =========================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var output = await _ctx.StockOutputs
                .AsNoTracking()
                .Include(x => x.Warehouse)
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (output == null) return NotFound();

            if (output.Lines != null)
                foreach (var l in output.Lines)
                    l.StockOutput = null;

            output.Warehouse = null;

            return Ok(output);
        }

        // =========================================================
        // POST: api/stockoutput
        // =========================================================
        [HttpPost]
        public async Task<IActionResult> CreateOutput(StockOutput output)
        {
            if (!await _periods.HasOpenPeriodForDate(output.OutputDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la salida.");
            if (output.Lines == null || !output.Lines.Any())
                return BadRequest("No se puede crear una salida sin líneas.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                // ✅ IMPORTANTE: separar líneas para que EF NO las inserte con la cabecera
                var lines = output.Lines.ToList();
                output.Lines = new List<StockOutputLine>();

                // (sano) evitar identity insert si el front manda Id
                output.Id = 0;

                // 1) Insertar cabecera sola
                _ctx.StockOutputs.Add(output);
                await _ctx.SaveChangesAsync(); // ya tenemos output.Id

                // 2) Procesar líneas (y recién acá insertarlas)
                foreach (var line in lines)
                {
                    line.Id = 0;                // ✅ evitar identity insert
                    line.StockOutputId = output.Id;
                    line.StockOutput = null;    // ✅ evitar tracking raro

                    var product = await _ctx.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId);
                    if (product == null)
                        return BadRequest($"Producto no encontrado (ID {line.ProductId})");

                    // 2) VALIDAR STOCK GENERAL
                    var stock = await _ctx.Stocks.FirstOrDefaultAsync(s =>
                        s.ProductId == line.ProductId &&
                        s.WarehouseId == line.WarehouseId);

                    if (stock == null || stock.Quantity < line.Quantity)
                        return BadRequest($"Stock insuficiente del producto {product.Name} en el depósito seleccionado.");

                    // =========================
                    // ✅ COSTEO (UnitCostApplied / LineCost)
                    // =========================
                    decimal unitCostApplied = 0m;

                    // 3) VALIDAR LOTES
                    if (product.IsBatchManaged)
                    {
                        if (string.IsNullOrWhiteSpace(line.BatchNumber))
                            return BadRequest($"El producto {product.Name} requiere lote.");

                        var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                            b.ProductId == line.ProductId &&
                            b.WarehouseId == line.WarehouseId &&
                            b.BatchNumber == line.BatchNumber);

                        if (batch == null)
                            return BadRequest($"El lote {line.BatchNumber} del producto {product.Name} no existe en este depósito.");

                        if (batch.Quantity < line.Quantity)
                            return BadRequest($"Stock insuficiente en el lote {line.BatchNumber} (Producto: {product.Name}).");

                        // ✅ costo del lote
                        unitCostApplied = batch.UnitCost;

                        // descontar lote
                        batch.Quantity -= line.Quantity;
                        batch.UpdatedAt = DateTime.UtcNow;
                    }

                    // 4) VALIDAR SERIALES
                    if (product.IsSerialManaged)
                    {
                        if (string.IsNullOrWhiteSpace(line.SerialNumbers))
                            return BadRequest($"Debe cargar los números de serie del producto {product.Name}.");

                        var serialList = line.SerialNumbers
                            .Split(new[] { ",", ";", "\n", "\r" }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim())
                            .Where(x => !string.IsNullOrWhiteSpace(x))
                            .Distinct()
                            .ToList();

                        // recomendado: qty = #seriales
                        if (serialList.Count != (int)line.Quantity)
                            return BadRequest($"Cantidad ({line.Quantity}) no coincide con seriales enviados ({serialList.Count}) para {product.Name}.");

                        decimal totalSerialCost = 0m;

                        foreach (var sn in serialList)
                        {
                            var serial = await _ctx.Serials.FirstOrDefaultAsync(s =>
                                s.ProductId == product.Id &&
                                s.WarehouseId == line.WarehouseId &&
                                s.SerialNumber == sn &&
                                s.IsActive == true);

                            if (serial == null)
                                return BadRequest($"El número de serie {sn} no está disponible o no pertenece a este depósito.");

                            totalSerialCost += serial.UnitCost; // ✅ costo específico
                            serial.IsActive = false;            // salida consume serial
                            serial.UpdatedAt = DateTime.UtcNow;
                        }

                        unitCostApplied = serialList.Count == 0 ? 0m : (totalSerialCost / serialList.Count);
                    }

                    // 5) COSTO PARA PRODUCTO NORMAL (promedio)
                    if (!product.IsBatchManaged && !product.IsSerialManaged)
                    {
                        unitCostApplied = stock.AvgCost; // ✅ promedio ponderado móvil por depósito
                    }

                    // guardar auditoría de costo
                    line.UnitCostApplied = unitCostApplied;
                    line.LineCost = Math.Round(line.Quantity * unitCostApplied, 2);

                    // 6) DESCONTAR STOCK GENERAL
                    stock.Quantity -= line.Quantity;
                    if (stock.Quantity <= 0) stock.Quantity = 0;

                    // ✅ Insertar línea UNA SOLA VEZ
                    _ctx.StockOutputLines.Add(line);
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                output.Lines = lines;
                return Ok(output);
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error en salida de inventario: {ex.Message}");
            }
        }
    }
}
