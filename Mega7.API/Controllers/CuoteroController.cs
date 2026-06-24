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
    public class CuoteroController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public CuoteroController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // =========================
        // GET: api/cuotero/summary?from=2025-07-01&to=2026-03-31&customerId=123
        // Lista clientes con cuotas + contadores y montos
        // =========================
        [RequirePermission(Perms.SalesParamsView)]
        [HttpGet("summary")]
        public async Task<IActionResult> Summary(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] int? customerId = null)
        {
            var (fromDate, toDate) = NormalizeRange(from, to);
            var today = DateTime.UtcNow.Date;

            var q = _ctx.ARInvoices
                .AsNoTracking()
                .Include(x => x.Installments)
                // si usás Status CANCELLED, mantenemos este filtro:
                .Where(x => (x.Status ?? "OPEN").ToUpper() != "CANCELLED")
                .Where(x => x.Installments.Any())
                .AsQueryable();

            if (customerId.HasValue)
                q = q.Where(x => x.CustomerId == customerId.Value);

            // filtrar por rango según DueDate de cuotas
            q = q.Where(x => x.Installments.Any(i =>
                i.DueDate.Date >= fromDate &&
                i.DueDate.Date <= toDate));

            var items = await q
                .GroupBy(x => new { x.CustomerId, x.CustomerName })
                .Select(g => new
                {
                    g.Key.CustomerId,
                    g.Key.CustomerName,

                    InvoicesCount = g.Select(x => x.Id).Distinct().Count(),

                    InstallmentsTotal = g.SelectMany(x => x.Installments)
                        .Count(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate),

                    InstallmentsPaid = g.SelectMany(x => x.Installments)
                        .Count(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate
                                    && (i.IsPaid || i.Balance <= 0m)),

                    InstallmentsOverdue = g.SelectMany(x => x.Installments)
                        .Count(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate
                                    && !(i.IsPaid || i.Balance <= 0m)
                                    && i.Balance > 0m
                                    && i.DueDate.Date < today),

                    InstallmentsOpen = g.SelectMany(x => x.Installments)
                        .Count(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate
                                    && !(i.IsPaid || i.Balance <= 0m)
                                    && i.Balance > 0m
                                    && i.DueDate.Date >= today),

                    TotalAmount = g.SelectMany(x => x.Installments)
                        .Where(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate)
                        .Sum(i => i.Amount),

                    PaidAmount = g.SelectMany(x => x.Installments)
                        .Where(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate)
                        .Sum(i => i.PaidAmount),

                    BalanceTotal = g.SelectMany(x => x.Installments)
                        .Where(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate)
                        .Sum(i => i.Balance),

                    OverdueBalance = g.SelectMany(x => x.Installments)
                        .Where(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate
                                    && !(i.IsPaid || i.Balance <= 0m)
                                    && i.Balance > 0m
                                    && i.DueDate.Date < today)
                        .Sum(i => i.Balance)
                })
                .OrderByDescending(x => x.OverdueBalance)
                .ThenBy(x => x.CustomerName)
                .ToListAsync();

            return Ok(new
            {
                from = fromDate,
                to = toDate,
                items
            });
        }

        // =========================
        // GET: api/cuotero/matrix?customerId=123&from=2025-07-01&to=2026-03-31
        // Matriz tipo Excel POR FACTURA (sin prorrateo):
        // columnas = meses yyyy-MM
        // filas = facturas
        // celda = cuota del mes (PDO / monto) + status
        // =========================
        [RequirePermission(Perms.SalesParamsView)]
        [HttpGet("matrix")]
        public async Task<IActionResult> Matrix(
            [FromQuery] int customerId,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var (fromDate, toDate) = NormalizeRange(from, to);
            var today = DateTime.UtcNow.Date;

            var columns = BuildMonthColumns(fromDate, toDate);

            var invoices = await _ctx.ARInvoices
                .AsNoTracking()
                .Include(x => x.Installments)
                .Where(x => x.CustomerId == customerId)
                .Where(x => (x.Status ?? "OPEN").ToUpper() != "CANCELLED")
                .Where(x => x.Installments.Any(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate))
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            var rows = invoices.Select(inv =>
            {
                // default null para todos los meses
                var cells = columns.ToDictionary(c => c, _ => (object?)null);

                foreach (var ins in inv.Installments
                    .Where(i => i.DueDate.Date >= fromDate && i.DueDate.Date <= toDate)
                    .OrderBy(i => i.DueDate))
                {
                    var key = $"{ins.DueDate:yyyy-MM}";

                    var paid = (ins.IsPaid || ins.Balance <= 0m);
                    var overdue = !paid && ins.Balance > 0m && ins.DueDate.Date < today;

                    var status = paid ? "PAID" : (overdue ? "OVERDUE" : "OPEN");
                    var daysOverdue = overdue ? (today - ins.DueDate.Date).Days : 0;

                    cells[key] = new
                    {
                        status,                 // PAID / OVERDUE / OPEN
                        colorHint = status,     // mismo valor para UI
                        display = paid ? "PDO" : $"{ins.Amount:n0}",

                        installmentId = ins.Id,
                        number = ins.Number,
                        dueDate = ins.DueDate,

                        amount = ins.Amount,
                        paidAmount = ins.PaidAmount,
                        balance = ins.Balance,

                        isPaid = paid,
                        daysOverdue
                    };
                }

                return new
                {
                    rowKey = $"INV-{inv.Id}",
                    arInvoiceId = inv.Id,
                    docNumber = inv.DocNumber,
                    invoiceDate = inv.InvoiceDate,
                    dueDate = inv.DueDate,
                    total = inv.Total,
                    paidAmount = inv.PaidAmount,
                    balance = inv.Balance,
                    status = inv.Status,
                    cells
                };
            }).ToList();

            return Ok(new
            {
                customerId,
                from = fromDate,
                to = toDate,
                columns,
                rows
            });
        }

        // =========================
        // Helpers
        // =========================
        private static (DateTime from, DateTime to) NormalizeRange(DateTime? from, DateTime? to)
        {
            // default: mes actual hasta +8 meses (tipo excel extendido)
            var now = DateTime.UtcNow.Date;
            var defaultFrom = new DateTime(now.Year, now.Month, 1);
            var defaultTo = defaultFrom.AddMonths(8).AddDays(-1);

            var f = (from ?? defaultFrom).Date;
            var t = (to ?? defaultTo).Date;

            if (t < f) (f, t) = (t, f);

            return (f, t);
        }

        private static List<string> BuildMonthColumns(DateTime from, DateTime to)
        {
            var cols = new List<string>();
            var cur = new DateTime(from.Year, from.Month, 1);
            var end = new DateTime(to.Year, to.Month, 1);

            while (cur <= end)
            {
                cols.Add($"{cur:yyyy-MM}");
                cur = cur.AddMonths(1);
            }

            return cols;
        }
    }
}
