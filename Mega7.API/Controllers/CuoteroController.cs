using Mega7.API.Attributes;
using Mega7.API.Data;
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
        // PATCH: api/cuotero/{arInvoiceId}/reschedule-day
        // Cambia el día de vencimiento de todas las cuotas PENDIENTES de una factura
        // =========================
        [RequirePermission(Perms.ARInvoicesView)]
        [HttpPatch("{arInvoiceId:int}/reschedule-day")]
        public async Task<IActionResult> RescheduleDay(int arInvoiceId, [FromBody] RescheduleDayRequest req)
        {
            if (req.DueDayOfMonth < 1 || req.DueDayOfMonth > 31)
                return BadRequest("El día debe estar entre 1 y 31.");

            var invoice = await _ctx.ARInvoices
                .Include(x => x.Installments)
                .FirstOrDefaultAsync(x => x.Id == arInvoiceId);

            if (invoice == null) return NotFound();

            var now = DateTime.UtcNow;
            var pending = invoice.Installments.Where(i => !i.IsPaid && i.Balance > 0).ToList();

            foreach (var inst in pending)
            {
                var d = inst.DueDate;
                var lastDay = DateTime.DaysInMonth(d.Year, d.Month);
                var newDay = Math.Min(req.DueDayOfMonth, lastDay);
                inst.DueDate = new DateTime(d.Year, d.Month, newDay, 0, 0, 0, DateTimeKind.Utc);
                inst.UpdatedAt = now;
            }

            invoice.DueDayOfMonth = req.DueDayOfMonth;
            invoice.InstallmentScheduleType = "DAY_OF_MONTH";
            invoice.UpdatedAt = now;

            await _ctx.SaveChangesAsync();

            return Ok(new { updated = pending.Count, dueDayOfMonth = req.DueDayOfMonth });
        }

        // =========================
        // POST: api/cuotero/import
        // Importa cuotas desde Excel (frontend parsea el archivo y envía JSON)
        // =========================
        [RequirePermission(Perms.ARInvoicesView)]
        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] CuoteroImportRequest req)
        {
            if (req.Rows == null || req.Rows.Count == 0)
                return BadRequest("No hay filas para importar.");

            var warehouse = await _ctx.Warehouses.FindAsync(req.WarehouseId);
            if (warehouse == null)
                return BadRequest("Depósito no encontrado.");

            // Número correlativo para DocNumber (máx existente con prefijo CIMP-)
            var existing = await _ctx.ARInvoices
                .Where(x => x.DocNumber.StartsWith("CIMP-"))
                .Select(x => x.DocNumber)
                .ToListAsync();

            int nextSeq = 1;
            foreach (var dn in existing)
            {
                if (int.TryParse(dn.Replace("CIMP-", ""), out var n) && n >= nextSeq)
                    nextSeq = n + 1;
            }

            var now = DateTime.UtcNow;
            var created = 0;
            var errors = new List<string>();

            foreach (var row in req.Rows)
            {
                if (row.Installments == null || row.Installments.Count == 0) continue;

                var customer = await _ctx.SociosNegocio.FindAsync(row.CustomerId);
                if (customer == null)
                {
                    errors.Add($"Cliente ID {row.CustomerId} no encontrado — fila '{row.ExcelName}' omitida.");
                    continue;
                }

                var totalAmount  = row.Installments.Sum(i => i.Amount);
                var paidAmount   = row.Installments.Where(i => i.IsPaid).Sum(i => i.Amount);
                var balance      = totalAmount - paidAmount;
                var status       = balance <= 0 ? "PAID" : (paidAmount > 0 ? "PARTIAL" : "OPEN");
                var firstDue     = row.Installments.OrderBy(i => i.DueDate).First().DueDate;
                var lastDue      = row.Installments.OrderBy(i => i.DueDate).Last().DueDate;

                var invoice = new ARInvoice
                {
                    CustomerId        = row.CustomerId,
                    CustomerName      = customer.RazonSocial,
                    DocNumber         = $"CIMP-{nextSeq:D4}",
                    InvoiceDate       = firstDue,
                    DueDate           = lastDue,
                    WarehouseId       = req.WarehouseId,
                    Status                  = status,
                    PaymentType             = "CUOTAS",
                    InstallmentsCount       = row.Installments.Count,
                    InstallmentScheduleType = "DAY_OF_MONTH",
                    DueDayOfMonth           = row.DueDayOfMonth,
                    SubTotal          = totalAmount,
                    TaxTotal          = 0,
                    Total             = totalAmount,
                    PaidAmount        = paidAmount,
                    Balance           = balance,
                    Comments          = string.IsNullOrWhiteSpace(row.Description)
                                            ? null
                                            : row.Description.Length > 500
                                                ? row.Description[..500]
                                                : row.Description,
                    CreatedAt         = now,
                };

                _ctx.ARInvoices.Add(invoice);
                await _ctx.SaveChangesAsync();

                var num = 1;
                foreach (var inst in row.Installments.OrderBy(i => i.DueDate))
                {
                    _ctx.ARInvoiceInstallments.Add(new ARInvoiceInstallment
                    {
                        ARInvoiceId = invoice.Id,
                        Number      = num++,
                        DueDate     = inst.DueDate,
                        Amount      = inst.Amount,
                        PaidAmount  = inst.IsPaid ? inst.Amount : 0,
                        Balance     = inst.IsPaid ? 0 : inst.Amount,
                        IsPaid      = inst.IsPaid,
                        CreatedAt   = now,
                    });
                }

                await _ctx.SaveChangesAsync();
                created++;
                nextSeq++;
            }

            return Ok(new { imported = created, errors });
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

    public class RescheduleDayRequest
    {
        public int DueDayOfMonth { get; set; }
    }

    // DTO para el endpoint de importación
    public class CuoteroImportRequest
    {
        public int WarehouseId { get; set; }
        public List<CuoteroImportRow> Rows { get; set; } = new();
    }

    public class CuoteroImportRow
    {
        public int CustomerId { get; set; }
        public string ExcelName { get; set; } = "";
        public string? Description { get; set; }
        public int DueDayOfMonth { get; set; } = 1;
        public List<CuoteroImportInstallment> Installments { get; set; } = new();
    }

    public class CuoteroImportInstallment
    {
        public DateTime DueDate { get; set; }
        public decimal Amount { get; set; }
        public bool IsPaid { get; set; }
    }
}
