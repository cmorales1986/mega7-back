using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    //[Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SalesInvoicesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        private readonly FiscalNumberService _fiscal;

        public SalesInvoicesController(Mega7DbContext ctx, PeriodService periods, FiscalNumberService fiscal)
        {
            _ctx = ctx;
            _periods = periods;
            _fiscal = fiscal;
        }

        // GET: api/salesinvoices
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] bool includeCancelled = false,
            [FromQuery] bool? overdue = null,
            [FromQuery] string? filter = null
        )
        {
            var today = DateTime.UtcNow.Date;

            var f = (filter ?? "").Trim().ToLowerInvariant();
            if (f == "overdue") overdue = true;

            var q = _ctx.ARInvoices
                .AsNoTracking()
                .Include(x => x.Customer)
                .Include(x => x.Warehouse)
                .OrderByDescending(x => x.Id)
                .AsQueryable();

            if (!includeCancelled)
                q = q.Where(x => (x.Status ?? "OPEN").ToUpper() != "CANCELLED");

            if (overdue == true || f == "overdue")
            {
                q = q.Where(x =>
                    x.DueDate.HasValue &&
                    x.DueDate.Value.Date < today &&
                    (x.Status ?? "OPEN").ToUpper() != "PAID" &&
                    (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                    x.Balance > 0m
                );
            }

            if (f == "today-unpaid")
            {
                q = q.Where(x =>
                    x.InvoiceDate.Date == today &&
                    (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                    x.Balance > 0m
                );
            }

            var list = await q.Select(x => new
            {
                x.Id,
                x.DocNumber,
                x.InvoiceDate,
                x.DueDate,
                x.CustomerId,
                x.CustomerName,
                Warehouse = x.Warehouse == null ? null : new { x.Warehouse.Id, x.Warehouse.Name },
                x.SalesOrderId,
                x.PaymentType,
                x.Total,
                x.PaidAmount,
                x.Balance,
                x.Status,
                x.ExternalNumber,

                // ✅ Fiscal snapshot (si ya lo tenés en ARInvoice)
                x.FiscalDocType,
                x.FiscalTimbrado,
                x.FiscalEstablishment,
                x.FiscalExpeditionPoint,
                x.FiscalNumber,
                x.FiscalFullNumber,
                x.FiscalSeriesId,

                IsCancelled = (x.Status ?? "OPEN").ToUpper() == "CANCELLED",
                IsPaid = (x.Status ?? "OPEN").ToUpper() == "PAID",
                IsPartial = (x.Status ?? "OPEN").ToUpper() == "PARTIAL",
                IsOpen = (x.Status ?? "OPEN").ToUpper() == "OPEN",
                IsOverdue = x.DueDate.HasValue &&
                            x.DueDate.Value.Date < today &&
                            (x.Status ?? "OPEN").ToUpper() != "PAID" &&
                            (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                            x.Balance > 0m
            }).ToListAsync();

            return Ok(list);
        }

        // GET: api/salesinvoices/{id}/pdf
        [HttpGet("{id:int}/pdf")]
        public async Task<IActionResult> Pdf(int id, [FromServices] InvoicePdfService pdfSvc)
        {
            try
            {
                var bytes = await pdfSvc.RenderSalesInvoicePdf(id);
                return File(bytes, "application/pdf", $"FV_{id}.pdf");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/salesinvoices/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var doc = await _ctx.ARInvoices
                .AsNoTracking()
                .Where(x => x.Id == id)
                .Select(x => new
                {
                    x.Id,
                    x.DocNumber,
                    x.InvoiceDate,
                    x.DueDate,
                    x.CustomerId,
                    x.CustomerName,
                    x.SalesOrderId,
                    x.WarehouseId,
                    Warehouse = x.Warehouse == null ? null : new { x.Warehouse.Id, x.Warehouse.Name },
                    x.PaymentType,
                    x.InstallmentsCount,
                    x.CreditTermId,
                    x.Comments,
                    x.SubTotal,
                    x.TaxTotal,
                    x.Total,
                    x.PaidAmount,
                    x.Balance,
                    x.Status,
                    x.CancelledAt,
                    x.CancelReason,
                    x.ExternalNumber,

                    // ✅ Fiscal snapshot
                    x.FiscalDocType,
                    x.FiscalTimbrado,
                    x.FiscalEstablishment,
                    x.FiscalExpeditionPoint,
                    x.FiscalNumber,
                    x.FiscalFullNumber,
                    x.FiscalSeriesId,

                    Lines = x.Lines.Select(l => new
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
                        l.LineSubTotal,
                        l.LineTax,
                        l.LineTotal
                    }).ToList(),
                    Installments = x.Installments.Select(i => new
                    {
                        i.Id,
                        i.Number,
                        i.DueDate,
                        i.Amount,
                        i.PaidAmount,
                        i.Balance,
                        i.IsPaid
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (doc == null) return NotFound();
            return Ok(doc);
        }

        // POST: api/salesinvoices/{id}/cancel
        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] ARInvoiceCancelDto? dto)
        {
            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                if (!await _periods.HasOpenPeriodForDate(DateTime.UtcNow))
                    return BadRequest("No existe un período ABIERTO para la fecha de la operación.");

                var ar = await _ctx.ARInvoices
                    .Include(x => x.Payments)
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (ar == null) return NotFound("CxC no existe.");

                var st = (ar.Status ?? "OPEN").ToUpperInvariant();
                if (st == "CANCELLED") return Ok(new { ok = true, ar.Id, ar.Status });

                var paidSum = ar.Payments.Where(p => !p.IsCancelled).Sum(p => p.Amount);
                if (paidSum > 0m)
                    return BadRequest("No se puede cancelar: la CxC tiene cobros registrados.");

                ar.Status = "CANCELLED";
                ar.CancelledAt = DateTime.UtcNow;
                ar.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason) ? "Cancelado manualmente." : dto!.Reason!.Trim();
                ar.Balance = 0m;
                ar.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, ar.Id, ar.Status, ar.Balance, ar.CancelledAt, ar.CancelReason });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }

        // POST: api/salesinvoices
        [HttpPost]
        public async Task<IActionResult> Create(SalesInvoiceCreateDto dto)
        {
            var invDate = dto.InvoiceDate == default ? DateTime.UtcNow : dto.InvoiceDate;

            if (!await _periods.HasOpenPeriodForDate(invDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la factura de venta.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();

            try
            {
                var so = await _ctx.SalesOrders
                    .Include(x => x.Customer)
                    .Include(x => x.Warehouse)
                    .Include(x => x.Lines).ThenInclude(l => l.Product)
                    .Include(x => x.Lines).ThenInclude(l => l.Tax)
                    .FirstOrDefaultAsync(x => x.Id == dto.SalesOrderId);

                if (so == null) return NotFound("Orden de venta no existe.");
                if (so.Status != "OPEN") return BadRequest("La OV debe estar en estado OPEN para facturar.");

                var customer = so.Customer!;
                if (customer.PartnerType != "C" && customer.PartnerType != "A")
                    return BadRequest("El socio no es Cliente.");

                var paymentType = (dto.PaymentType ?? "CASH").ToUpperInvariant();
                if (paymentType != "CASH" && paymentType != "CREDIT")
                    return BadRequest("PaymentType inválido. Use CASH o CREDIT.");

                var wantsInstallments = paymentType == "CREDIT" && dto.CreditInstallments;
                var nInstallments = wantsInstallments ? (dto.InstallmentsCount ?? 0) : 0;

                if (wantsInstallments && nInstallments < 2)
                    return BadRequest("Si activás cuotas, InstallmentsCount debe ser >= 2.");

                int? creditTermId = null;
                CreditTerm? term = null;

                if (paymentType == "CREDIT")
                {
                    creditTermId = dto.CreditTermId ?? customer.CreditTermId;
                    if (creditTermId.HasValue)
                        term = await _ctx.Set<CreditTerm>().FirstOrDefaultAsync(t => t.Id == creditTermId.Value);

                    if (term == null && (dto.CreditDays < 0))
                        return BadRequest("CreditDays inválido.");
                }

                var pending = so.Lines
                    .Select(l => new { Line = l, PendingQty = (l.Quantity - l.InvoicedQuantity) })
                    .Where(x => x.PendingQty > 0)
                    .ToList();

                if (!pending.Any())
                    return BadRequest("La OV no tiene cantidad pendiente para facturar.");

                List<(SalesOrderLine line, decimal qty, string? batch, string? serials)> toInvoice;

                if (dto.Lines == null || dto.Lines.Count == 0)
                {
                    toInvoice = pending.Select(x => (x.Line, x.PendingQty, (string?)null, (string?)null)).ToList();
                }
                else
                {
                    toInvoice = new();

                    foreach (var req in dto.Lines)
                    {
                        var l = so.Lines.FirstOrDefault(x => x.Id == req.SalesOrderLineId);
                        if (l == null) return BadRequest("Línea de OV inválida.");

                        var pqty = l.Quantity - l.InvoicedQuantity;
                        if (pqty <= 0) return BadRequest("Una línea no tiene pendiente.");

                        if (req.Quantity <= 0 || req.Quantity > pqty)
                            return BadRequest("Cantidad a facturar inválida en una línea.");

                        toInvoice.Add((l, req.Quantity, req.BatchNumber, req.SerialNumbers));
                    }
                }

                var ar = new ARInvoice
                {
                    DocNumber = await GenerateNextDocNumber(),
                    InvoiceDate = invDate,

                    CustomerId = customer.Id,
                    CustomerName = so.CustomerName,

                    SalesOrderId = so.Id,
                    WarehouseId = so.WarehouseId,

                    PaymentType = paymentType,
                    InstallmentsCount = wantsInstallments ? nInstallments : null,
                    CreditTermId = paymentType == "CREDIT" ? creditTermId : null,

                    ExternalNumber = string.IsNullOrWhiteSpace(dto.ExternalNumber) ? null : dto.ExternalNumber.Trim(),
                    Comments = dto.Comments
                };

                var productIds = toInvoice.Select(x => x.line.ProductId).Distinct().ToList();
                var products = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();

                foreach (var x in toInvoice)
                {
                    var soLine = x.line;
                    var p = products.First(pp => pp.Id == soLine.ProductId);

                    var discountFactor = (100m - soLine.DiscountPercent) / 100m;
                    var sub = Math.Round(x.qty * soLine.UnitPrice * discountFactor, 2);

                    var taxRate = soLine.Tax?.Rate ?? 0m;
                    var taxAmt = Math.Round(sub * (taxRate / 100m), 2);
                    var total = sub + taxAmt;

                    var stock = await _ctx.Stocks
                        .FirstOrDefaultAsync(s => s.ProductId == p.Id && s.WarehouseId == so.WarehouseId);

                    if (stock == null || stock.Quantity < x.qty)
                        return BadRequest($"Stock insuficiente de {p.Name} en el depósito seleccionado.");

                    if (p.IsBatchManaged)
                    {
                        if (string.IsNullOrWhiteSpace(x.batch))
                            return BadRequest($"El producto {p.Name} requiere lote (BatchNumber).");

                        var batch = await _ctx.Batches.FirstOrDefaultAsync(b =>
                            b.ProductId == p.Id &&
                            b.WarehouseId == so.WarehouseId &&
                            b.BatchNumber == x.batch);

                        if (batch == null)
                            return BadRequest($"El lote {x.batch} no existe para {p.Name} en este depósito.");

                        if (batch.Quantity < x.qty)
                            return BadRequest($"Stock insuficiente en lote {x.batch} (Producto: {p.Name}).");

                        batch.Quantity -= x.qty;
                        batch.UpdatedAt = DateTime.UtcNow;
                    }

                    if (p.IsSerialManaged)
                    {
                        if (string.IsNullOrWhiteSpace(x.serials))
                            return BadRequest($"Debe cargar SerialNumbers para {p.Name}.");

                        var serialList = x.serials.Split(",").Select(s => s.Trim()).Where(s => s.Length > 0).ToList();

                        if (serialList.Count != (int)x.qty)
                            return BadRequest($"Cantidad de seriales no coincide con cantidad para {p.Name}.");

                        foreach (var sn in serialList)
                        {
                            var serial = await _ctx.Serials.FirstOrDefaultAsync(s =>
                                s.ProductId == p.Id &&
                                s.WarehouseId == so.WarehouseId &&
                                s.SerialNumber == sn &&
                                s.IsActive == true);

                            if (serial == null)
                                return BadRequest($"El serial {sn} no está disponible en este depósito.");

                            serial.IsActive = false;
                        }
                    }

                    stock.Quantity -= x.qty;

                    ar.Lines.Add(new ARInvoiceLine
                    {
                        ProductId = p.Id,
                        ProductCode = soLine.ProductCode,
                        ProductName = soLine.ProductName,
                        Quantity = x.qty,
                        UnitPrice = soLine.UnitPrice,
                        DiscountPercent = soLine.DiscountPercent,
                        TaxId = soLine.TaxId,
                        BatchNumber = x.batch,
                        SerialNumbers = x.serials,
                        LineSubTotal = sub,
                        LineTax = taxAmt,
                        LineTotal = total
                    });

                    soLine.InvoicedQuantity += x.qty;
                }

                ar.SubTotal = ar.Lines.Sum(l => l.LineSubTotal);
                ar.TaxTotal = ar.Lines.Sum(l => l.LineTax);
                ar.Total = ar.Lines.Sum(l => l.LineTotal);

                ar.PaidAmount = 0m;
                ar.Balance = ar.Total;
                ar.Status = "OPEN";

                // ===== VENCIMIENTO / CUOTAS AUTOMÁTICAS =====
                if (paymentType == "CASH")
                {
                    ar.DueDate = invDate.Date;
                    ar.InstallmentsCount = null;
                }
                else
                {
                    var creditDays = dto.CreditDays;
                    if (creditDays <= 0 && term != null) creditDays = term.Days;
                    if (creditDays < 0) creditDays = 0;

                    if (wantsInstallments)
                    {
                        var n = nInstallments;

                        var scheduleType = (dto.InstallmentScheduleType ?? "INTERVAL")
                            .Trim()
                            .ToUpperInvariant();

                        var baseAmount = Math.Round(ar.Total / n, 2);
                        decimal acc = 0m;

                        if (scheduleType == "DAY_OF_MONTH")
                        {
                            if (dto.DueDayOfMonth == null)
                                return BadRequest("DueDayOfMonth es requerido cuando InstallmentScheduleType = DAY_OF_MONTH.");

                            var dueDay = dto.DueDayOfMonth.Value;
                            if (dueDay < 1 || dueDay > 31)
                                return BadRequest("DueDayOfMonth debe estar entre 1 y 31.");

                            var baseDate = (dto.FirstDueDate?.Date ?? invDate.Date.AddDays(creditDays));
                            var firstDue = ComputeFirstDueFixedDay(baseDate, dueDay, dto.FirstDueRule);

                            for (int k = 1; k <= n; k++)
                            {
                                var amt = (k == n) ? (ar.Total - acc) : baseAmount;
                                acc += amt;

                                var m = firstDue.AddMonths(k - 1);
                                var due = ClampDueDay(m.Year, m.Month, dueDay);

                                ar.Installments.Add(new ARInvoiceInstallment
                                {
                                    Number = k,
                                    DueDate = due,
                                    Amount = amt,
                                    PaidAmount = 0m,
                                    Balance = amt,
                                    IsPaid = false,
                                    CreatedAt = DateTime.UtcNow
                                });
                            }

                            ar.DueDate = ar.Installments.Max(x => x.DueDate);
                        }
                        else
                        {
                            var firstDue = dto.FirstDueDate?.Date ?? invDate.Date.AddDays(creditDays);
                            var interval = dto.IntervalDays > 0 ? dto.IntervalDays : 30;

                            for (int k = 1; k <= n; k++)
                            {
                                var amt = (k == n) ? (ar.Total - acc) : baseAmount;
                                acc += amt;

                                var due = firstDue.AddDays(interval * (k - 1));

                                ar.Installments.Add(new ARInvoiceInstallment
                                {
                                    Number = k,
                                    DueDate = due,
                                    Amount = amt,
                                    PaidAmount = 0m,
                                    Balance = amt,
                                    IsPaid = false,
                                    CreatedAt = DateTime.UtcNow
                                });
                            }

                            ar.DueDate = ar.Installments.Max(x => x.DueDate);
                        }
                    }
                    else
                    {
                        ar.DueDate = invDate.Date.AddDays(creditDays);
                        ar.InstallmentsCount = null;
                    }
                }

                var remaining = so.Lines.Sum(l => (l.Quantity - l.InvoicedQuantity));
                if (remaining <= 0) so.Status = "CLOSED";

                // =========================================================
                // ✅ NUMERACIÓN FISCAL (preparado para 1 o N cajas)
                // - si dto.FiscalSeriesId viene => usa esa serie
                // - si no viene:
                //   - si hay 1 sola activa/vigente para FACTURA => la usa
                //   - si hay 0 => error
                //   - si hay >1 => error (front debe elegir)
                // =========================================================
                const string docType = "FACTURA";
                var onDate = invDate.Date;

                int seriesId;

                if (dto.FiscalSeriesId.HasValue)
                {
                    seriesId = dto.FiscalSeriesId.Value;
                }
                else
                {
                    var candidates = await _ctx.Set<FiscalDocumentSeries>()
                        .AsNoTracking()
                        .Where(s =>
                            s.IsActive &&
                            s.DocumentType == docType &&
                            onDate >= s.ValidFrom.Date &&
                            onDate <= s.ValidTo.Date)
                        .OrderByDescending(s => s.Id)
                        .ToListAsync();

                    if (candidates.Count == 0)
                        return BadRequest("No hay talonario/timbrado activo y vigente para FACTURA.");

                    if (candidates.Count > 1)
                        return BadRequest("Hay más de un talonario activo para FACTURA. Debe seleccionar uno (FiscalSeriesId).");

                    seriesId = candidates[0].Id;
                }

                var reservation = await _fiscal.ReserveByIdAsync(seriesId, onDate);

                ar.FiscalSeriesId = reservation.SeriesId;
                ar.FiscalDocType = reservation.DocumentType;
                ar.FiscalTimbrado = reservation.Timbrado;
                ar.FiscalEstablishment = reservation.Establishment;
                ar.FiscalExpeditionPoint = reservation.ExpeditionPoint;
                ar.FiscalNumber = reservation.Number;
                ar.FiscalFullNumber = reservation.FullNumber;

                // Si querés que ExternalNumber sea el fiscal:
                ar.ExternalNumber = reservation.FullNumber;

                _ctx.ARInvoices.Add(ar);
                so.UpdatedAt = DateTime.UtcNow;

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(ar);
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest($"Error al facturar: {ex.Message}");
            }
        }

        private async Task<string> GenerateNextDocNumber()
        {
            var last = await _ctx.ARInvoices
                .OrderByDescending(x => x.Id)
                .Select(x => x.DocNumber)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(last))
                return "FV000001";

            var numPart = new string(last.Where(char.IsDigit).ToArray());
            if (!int.TryParse(numPart, out var n)) n = 0;

            n++;
            return $"FV{n:D6}";
        }

        private static DateTime ClampDueDay(int year, int month, int dueDay)
        {
            if (dueDay < 1) dueDay = 1;
            if (dueDay > 31) dueDay = 31;

            var last = DateTime.DaysInMonth(year, month);
            var d = Math.Min(dueDay, last);
            return new DateTime(year, month, d);
        }

        private static DateTime ComputeFirstDueFixedDay(DateTime baseDate, int dueDay, string? firstDueRule)
        {
            var rule = (firstDueRule ?? "AUTO").Trim().ToUpperInvariant();

            if (rule == "NEXT_MONTH")
            {
                var nm = baseDate.AddMonths(1);
                return ClampDueDay(nm.Year, nm.Month, dueDay);
            }

            var candidate = ClampDueDay(baseDate.Year, baseDate.Month, dueDay);

            if (baseDate.Day > dueDay)
            {
                var nm = baseDate.AddMonths(1);
                candidate = ClampDueDay(nm.Year, nm.Month, dueDay);
            }

            return candidate;
        }
    }
}
