using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.API.Utils;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly InvoicePdfService _pdf;

        public ReportsController(Mega7DbContext ctx, InvoicePdfService pdf)
        {
            _ctx = ctx;
            _pdf = pdf;
        }

        // GET: api/reports/sales-vs-collections?year=2026
        // - sales: suma de ARInvoices.Total por InvoiceDate del mes (excluye CANCELLED)
        // - collected: suma de ARInvoicePayments.Amount por PaymentDate del mes (excluye IsCancelled)
        [RequirePermission(Perms.ReportsView)]
        [HttpGet("sales-vs-collections")]
        public async Task<IActionResult> SalesVsCollections([FromQuery] int? year = null)
        {
            var y = year ?? DateTime.UtcNow.Year;

            var start = new DateTime(y, 1, 1);
            var end = start.AddYears(1);

            // Ventas (facturado) por mes
            var salesByMonth = await _ctx.ARInvoices
                .AsNoTracking()
                .Where(i =>
                    i.InvoiceDate >= start &&
                    i.InvoiceDate < end &&
                    (i.Status ?? "OPEN").ToUpper() != "CANCELLED"
                )
                .GroupBy(i => i.InvoiceDate.Month)
                .Select(g => new
                {
                    Month = g.Key,
                    Sales = g.Sum(x => (decimal?)x.Total) ?? 0m
                })
                .ToListAsync();

            // Cobros por mes
            var collectionsByMonth = await _ctx.ARInvoicePayments
                .AsNoTracking()
                .Where(p =>
                    !p.IsCancelled &&
                    p.PaymentDate >= start &&
                    p.PaymentDate < end
                )
                .GroupBy(p => p.PaymentDate.Month)
                .Select(g => new
                {
                    Month = g.Key,
                    Collected = g.Sum(x => (decimal?)x.Amount) ?? 0m
                })
                .ToListAsync();

            var salesMap = salesByMonth.ToDictionary(x => x.Month, x => x.Sales);
            var colMap = collectionsByMonth.ToDictionary(x => x.Month, x => x.Collected);

            string MonthLabel(int m) => m switch
            {
                1 => "Ene",
                2 => "Feb",
                3 => "Mar",
                4 => "Abr",
                5 => "May",
                6 => "Jun",
                7 => "Jul",
                8 => "Ago",
                9 => "Sep",
                10 => "Oct",
                11 => "Nov",
                12 => "Dic",
                _ => $"M{m}"
            };

            var result = Enumerable.Range(1, 12)
                .Select(m => new
                {
                    month = MonthLabel(m),
                    monthNo = m,
                    sales = salesMap.TryGetValue(m, out var s) ? s : 0m,
                    collected = colMap.TryGetValue(m, out var c) ? c : 0m
                })
                .ToList();

            return Ok(result);
        }

        // GET: api/reports/resumen-dia?date=2026-06-24
        [RequirePermission(Perms.ReportsView)]
        [HttpGet("resumen-dia")]
        public async Task<IActionResult> ResumenDia([FromQuery] DateTime? date = null)
        {
            var d    = (date ?? DateTime.UtcNow).Date;
            var dEnd = d.AddDays(1);

            var facturas = await _ctx.ARInvoices
                .Where(x => x.InvoiceDate >= d && x.InvoiceDate < dEnd
                         && (x.Status ?? "OPEN").ToUpper() != "CANCELLED")
                .Select(x => new { x.Total, x.DocNumber })
                .ToListAsync();

            var cobros = await _ctx.Set<ARSalesReceipt>()
                .Where(x => x.ReceiptDate >= d && x.ReceiptDate < dEnd)
                .Select(x => x.TotalReceived)
                .ToListAsync();

            var vencidas = await _ctx.ARInvoices
                .CountAsync(x => x.DueDate.HasValue
                              && x.DueDate.Value.Date <= d
                              && ((x.Status ?? "OPEN").ToUpper() == "OPEN"
                               || (x.Status ?? "OPEN").ToUpper() == "PARTIAL"));

            return Ok(new
            {
                date           = d,
                totalFacturado = facturas.Sum(x => x.Total),
                cantFacturas   = facturas.Count,
                totalCobrado   = cobros.Sum(),
                cantCobros     = cobros.Count,
                facturasVencidas = vencidas
            });
        }

        // GET: api/reports/aging-cxc
        [RequirePermission(Perms.ReportsView)]
        [HttpGet("aging-cxc")]
        public async Task<IActionResult> AgingCxC()
        {
            var today = DateTime.UtcNow.Date;

            var open = await _ctx.ARInvoices
                .Where(x => ((x.Status ?? "OPEN").ToUpper() == "OPEN"
                          || (x.Status ?? "OPEN").ToUpper() == "PARTIAL")
                         && x.Balance > 0)
                .Select(x => new
                {
                    x.CustomerId,
                    x.CustomerName,
                    x.DueDate,
                    x.Balance
                })
                .ToListAsync();

            var result = open
                .GroupBy(x => new { x.CustomerId, x.CustomerName })
                .Select(g =>
                {
                    decimal corriente = 0, d30 = 0, d60 = 0, d90 = 0, dMas = 0;
                    foreach (var inv in g)
                    {
                        var dias = inv.DueDate.HasValue
                            ? (int)(today - inv.DueDate.Value.Date).TotalDays
                            : 0;
                        if      (dias <= 0)  corriente += inv.Balance;
                        else if (dias <= 30) d30       += inv.Balance;
                        else if (dias <= 60) d60       += inv.Balance;
                        else if (dias <= 90) d90       += inv.Balance;
                        else                 dMas      += inv.Balance;
                    }
                    return new
                    {
                        customerId   = g.Key.CustomerId,
                        customerName = g.Key.CustomerName,
                        corriente,
                        dias1_30     = d30,
                        dias31_60    = d60,
                        dias61_90    = d90,
                        diasMas90    = dMas,
                        total        = corriente + d30 + d60 + d90 + dMas
                    };
                })
                .Where(x => x.total > 0)
                .OrderByDescending(x => x.total)
                .ToList();

            return Ok(result);
        }

        // GET: api/reports/stock-actual?warehouseId=0
        [RequirePermission(Perms.ReportsView)]
        [HttpGet("stock-actual")]
        public async Task<IActionResult> StockActual([FromQuery] int? warehouseId = null)
        {
            var q = _ctx.Stocks
                .AsNoTracking()
                .Include(x => x.Product)
                .Include(x => x.Warehouse)
                .AsQueryable();

            if (warehouseId.HasValue && warehouseId > 0)
                q = q.Where(x => x.WarehouseId == warehouseId.Value);

            var data = await q
                .Select(x => new
                {
                    x.ProductId,
                    productCode   = x.Product!.Code,
                    productName   = x.Product.Name,
                    warehouseId   = x.WarehouseId,
                    warehouseName = x.Warehouse!.Name,
                    quantity      = x.Quantity,
                    minimumStock  = x.Product.MinimumStock,
                    avgCost       = x.AvgCost,
                    totalValue    = x.Quantity * x.AvgCost,
                    belowMin      = x.Quantity < x.Product.MinimumStock
                })
                .OrderBy(x => x.productName)
                .ToListAsync();

            return Ok(data);
        }

        // GET: api/reports/sales-invoice/123/pdf
        [RequirePermission(Perms.ReportsView)]
        [HttpGet("sales-invoice/{id}/pdf")]
        public async Task<IActionResult> SalesInvoicePdf(int id)
        {
            var pdfBytes = await _pdf.RenderSalesInvoicePdf(id);
            return File(pdfBytes, "application/pdf", $"FV_{id}.pdf");
        }

        // GET: api/reports/sales-receipt/123/pdf
        [RequirePermission(Perms.ReportsView)]
        [HttpGet("sales-receipt/{id}/pdf")]
        public async Task<IActionResult> SalesReceiptPdf(int id)
        {
            var pdfBytes = await _pdf.RenderSalesReceiptPdf(id);
            return File(pdfBytes, "application/pdf", $"RECIBO_{id}.pdf");
        }
    }
}
