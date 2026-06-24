using Mega7.API.Data;
using Mega7.API.Services;
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
        private readonly ReportingProxy _proxy;

        public ReportsController(Mega7DbContext ctx, ReportingProxy proxy)
        {
            _ctx = ctx;
            _proxy = proxy;
        }

        // GET: api/reports/sales-vs-collections?year=2026
        // - sales: suma de ARInvoices.Total por InvoiceDate del mes (excluye CANCELLED)
        // - collected: suma de ARInvoicePayments.Amount por PaymentDate del mes (excluye IsCancelled)
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

        // GET: api/reports/sales-invoice/123/pdf
        [HttpGet("sales-invoice/{id}/pdf")]
        public async Task<IActionResult> SalesInvoicePdf(int id)
        {
            var pdf = await _proxy.RenderSalesInvoicePdfAsync(id, _ctx);

            // nombre sugerido
            var fileName = $"FV_{id}.pdf";
            return File(pdf, "application/pdf", fileName);
        }

        // GET: api/reports/sales-receipt/123/pdf
        [HttpGet("sales-receipt/{id}/pdf")]
        public async Task<IActionResult> SalesReceiptPdf(int id)
        {
            var pdf = await _proxy.RenderSalesReceiptPdfAsync(id, _ctx);
            var fileName = $"RECIBO_{id}.pdf";
            return File(pdf, "application/pdf", fileName);
        }
    }
}
