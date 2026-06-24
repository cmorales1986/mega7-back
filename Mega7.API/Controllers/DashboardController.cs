using Mega7.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        public DashboardController(Mega7DbContext ctx) => _ctx = ctx;

        [HttpGet("kpis")]
        public async Task<IActionResult> GetKpis()
        {
            var today = DateTime.UtcNow.Date;
            var monthStart = new DateTime(today.Year, today.Month, 1);

            var arOpenQuery = _ctx.ARInvoices
                .AsNoTracking()
                .Where(x =>
                    (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                    x.Balance > 0m
                );

            var arTotal = await arOpenQuery.SumAsync(x => (decimal?)x.Balance) ?? 0m;

            var overdueCustomers = await arOpenQuery
                .Where(x => x.DueDate.HasValue && x.DueDate.Value.Date < today)
                .Select(x => x.CustomerId)
                .Distinct()
                .CountAsync();

            var salesThisMonth = await _ctx.ARInvoices
                .AsNoTracking()
                .Where(x =>
                    (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                    x.InvoiceDate.Date >= monthStart &&
                    x.InvoiceDate.Date <= today
                )
                .SumAsync(x => (decimal?)x.Total) ?? 0m;

            return Ok(new
            {
                arTotal,
                apTotal = 0m, // luego enchufamos AP
                overdueCustomers,
                salesThisMonth
            });
        }
    }
}
