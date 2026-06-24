using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Pdf;
using Mega7.API.Services;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Mega7.SHARED.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SalesOrdersController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;
        private readonly SalesPricingService _pricing;

        public SalesOrdersController(Mega7DbContext ctx, PeriodService periods, SalesPricingService pricing)
        {
            _ctx = ctx;
            _periods = periods;
            _pricing = pricing;
        }

        // GET: api/salesorders
        [RequirePermission(Perms.SalesOrdersView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.SalesOrders
                .Include(x => x.Customer)
                .Include(x => x.Warehouse)
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/salesorders/5
        [RequirePermission(Perms.SalesOrdersView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var doc = await _ctx.SalesOrders
                .Include(x => x.Customer)
                .Include(x => x.Warehouse)
                .Include(x => x.Lines)
                    .ThenInclude(l => l.Product)
                .Include(x => x.Lines)
                    .ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();
            return Ok(doc);
        }

        // GET: api/salesorders/open
        [RequirePermission(Perms.SalesOrdersView)]
        [HttpGet("open")]
        public async Task<IActionResult> GetOpen()
        {
            var list = await _ctx.SalesOrders
                .Where(x => x.Status == "OPEN")
                .Include(x => x.Customer)
                .Include(x => x.Warehouse)
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/salesorders/{id}/pending  (para futura facturación parcial)
        [RequirePermission(Perms.SalesOrdersView)]
        [HttpGet("{id}/pending")]
        public async Task<IActionResult> GetPending(int id)
        {
            var doc = await _ctx.SalesOrders
                .Include(x => x.Customer)
                .Include(x => x.Warehouse)
                .Include(x => x.Lines).ThenInclude(l => l.Product)
                .Include(x => x.Lines).ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            if (doc.Status != "OPEN")
                return BadRequest("La OV no está en estado OPEN.");

            var pendingLines = doc.Lines
                .Select(l => new
                {
                    l.Id,
                    l.ProductId,
                    l.ProductCode,
                    l.ProductName,

                    OrderedQty = l.Quantity,
                    InvoicedQty = l.InvoicedQuantity,
                    PendingQty = (l.Quantity - l.InvoicedQuantity),

                    l.UnitPrice,
                    l.DiscountPercent,
                    l.TaxId,
                    TaxRate = l.Tax != null ? l.Tax.Rate : 0m,

                    l.LineSubTotal,
                    l.LineTax,
                    l.LineTotal
                })
                .Where(x => x.PendingQty > 0)
                .ToList();

            return Ok(new
            {
                doc.Id,
                doc.DocNumber,
                doc.OrderDate,
                doc.Status,
                doc.CustomerId,
                doc.CustomerName,
                WarehouseId = doc.WarehouseId,
                WarehouseName = doc.Warehouse != null ? doc.Warehouse.Name : null,
                doc.Comments,

                doc.DocumentDiscountPercent,
                doc.DocumentDiscountAmount,

                doc.SubTotal,
                doc.TaxTotal,
                doc.Total,
                Lines = pendingLines
            });
        }

        [RequirePermission(Perms.SalesOrdersView)]
        [HttpGet("{id}/pdf")]
        public async Task<IActionResult> Pdf(int id)
        {
            var doc = await _ctx.SalesOrders
                .Include(x => x.Customer)
                .Include(x => x.Warehouse)
                .Include(x => x.Lines).ThenInclude(l => l.Product)
                .Include(x => x.Lines).ThenInclude(l => l.Tax)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            var logoPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "logo.png");

            var pdf = new SalesOrderPdf(doc, logoPath);
            var bytes = pdf.GeneratePdf();

            return File(bytes, "application/pdf", $"PRESUPUESTO_{doc.DocNumber}.pdf");
        }

        // ==========================================================
        // NUEVO: SIMULADOR DE 3 OPCIONES (SAP style) SIN GUARDAR
        // POST: api/salesorders/pricing-options/simulate
        // Devuelve: Contado / Crédito (CreditTermId) / Cuotas (max N)
        // ==========================================================
        public class SimulateSalesOrderPricingOptionsRequestDto
        {
            public int CustomerId { get; set; }
            public int WarehouseId { get; set; }

            // opción crédito
            public int? CreditTermId { get; set; }

            // opción cuotas
            public int MaxInstallmentsCount { get; set; } = 12;
            public int? InstallmentIntervalDays { get; set; } = 30;

            public List<SimulateSalesOrderLineDto> Lines { get; set; } = new();
        }

        public class SimulateSalesOrderLineDto
        {
            public int ProductId { get; set; }
            public decimal Quantity { get; set; }
            public decimal DiscountPercent { get; set; }
            public int? TaxId { get; set; }
        }

        public class SalesOrderPricingOptionDto
        {
            public PaymentType PaymentType { get; set; }

            public int? CreditTermId { get; set; }
            public string? CreditTermName { get; set; }
            public int? CreditDays { get; set; }

            public int? InstallmentsCount { get; set; }
            public int? InstallmentIntervalDays { get; set; }

            public decimal MarkupPctApplied { get; set; }
            public decimal SubTotal { get; set; }
            public decimal TaxTotal { get; set; }
            public decimal Total { get; set; }

            public string? RuleInfo { get; set; }

            public List<SalesOrderPricingOptionLineDto> Lines { get; set; } = new();
        }

        public class SalesOrderPricingOptionLineDto
        {
            public int ProductId { get; set; }
            public string ProductCode { get; set; } = "";
            public string ProductName { get; set; } = "";

            public decimal Quantity { get; set; }
            public decimal CostUsed { get; set; }

            public decimal UnitPriceSuggested { get; set; }
            public decimal DiscountPercent { get; set; }

            public int? TaxId { get; set; }
            public decimal TaxRate { get; set; }

            public decimal LineSubTotal { get; set; }
            public decimal LineTax { get; set; }
            public decimal LineTotal { get; set; }
        }

        [RequirePermission(Perms.SalesOrdersView)]
        [HttpPost("pricing-options/simulate")]
        public async Task<IActionResult> SimulatePricingOptions([FromBody] SimulateSalesOrderPricingOptionsRequestDto req)
        {
            if (req.CustomerId <= 0) return BadRequest("CustomerId inválido.");
            if (req.WarehouseId <= 0) return BadRequest("WarehouseId inválido.");
            if (req.Lines == null || req.Lines.Count == 0) return BadRequest("Debe enviar líneas.");
            if (req.Lines.Any(l => l.Quantity <= 0)) return BadRequest("Cantidad debe ser > 0.");
            if (req.Lines.Any(l => l.DiscountPercent < 0 || l.DiscountPercent > 100)) return BadRequest("Descuento inválido (línea).");

            var customer = await _ctx.SociosNegocio.AsNoTracking().FirstOrDefaultAsync(x => x.Id == req.CustomerId);
            if (customer == null) return BadRequest("Cliente no existe.");

            // cliente = C o A (Ambos)
            if (customer.PartnerType != "C" && customer.PartnerType != "A")
                return BadRequest("El socio seleccionado no es Cliente (PartnerType = 'C' o 'A').");

            // Validar depósito existe (aunque acá no afecte el pricing todavía)
            var wh = await _ctx.Warehouses.AsNoTracking().FirstOrDefaultAsync(w => w.Id == req.WarehouseId);
            if (wh == null) return BadRequest("Depósito no existe.");

            var productIds = req.Lines.Select(x => x.ProductId).Distinct().ToList();
            var products = await _ctx.Products.AsNoTracking().Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Count)
                return BadRequest("Uno o más productos no existen.");

            var taxIds = req.Lines.Where(x => x.TaxId.HasValue).Select(x => x.TaxId!.Value).Distinct().ToList();
            var taxes = await _ctx.Taxes.AsNoTracking().Where(t => taxIds.Contains(t.Id)).ToListAsync();

            // credit term (si viene)
            CreditTerm? creditTerm = null;
            if (req.CreditTermId.HasValue)
            {
                creditTerm = await _ctx.CreditTerms.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == req.CreditTermId.Value && x.IsActive);

                if (creditTerm == null)
                    return BadRequest("CreditTermId inválido o inactivo.");
            }

            var options = new List<SalesOrderPricingOptionDto>();

            // 1) Contado
            options.Add(await BuildOptionDto(
                customerId: req.CustomerId,
                paymentType: PaymentType.Cash,
                creditTerm: null,
                installmentsCount: null,
                intervalDays: null,
                req.Lines,
                products,
                taxes));

            // 2) Crédito (con creditTerm si existe; si no, igual usa default crédito)
            options.Add(await BuildOptionDto(
                customerId: req.CustomerId,
                paymentType: PaymentType.Credit,
                creditTerm: creditTerm,
                installmentsCount: null,
                intervalDays: null,
                req.Lines,
                products,
                taxes));

            // 3) Cuotas
            var maxInst = req.MaxInstallmentsCount <= 0 ? 12 : req.MaxInstallmentsCount;
            options.Add(await BuildOptionDto(
                customerId: req.CustomerId,
                paymentType: PaymentType.Installments,
                creditTerm: null,
                installmentsCount: maxInst,
                intervalDays: req.InstallmentIntervalDays,
                req.Lines,
                products,
                taxes));

            return Ok(options);
        }

        private async Task<SalesOrderPricingOptionDto> BuildOptionDto(
            int customerId,
            PaymentType paymentType,
            CreditTerm? creditTerm,
            int? installmentsCount,
            int? intervalDays,
            List<SimulateSalesOrderLineDto> lines,
            List<Product> products,
            List<Tax> taxes)
        {
            var dto = new SalesOrderPricingOptionDto
            {
                PaymentType = paymentType,
                CreditTermId = creditTerm?.Id,
                CreditTermName = creditTerm?.Name,
                CreditDays = creditTerm?.Days,
                InstallmentsCount = installmentsCount,
                InstallmentIntervalDays = intervalDays
            };

            decimal lastMarkupPct = 0m;
            string? lastRuleInfo = null;

            foreach (var l in lines)
            {
                var p = products.First(x => x.Id == l.ProductId);
                var tax = l.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == l.TaxId.Value) : null;

                if (p.Cost <= 0m)
                    throw new InvalidOperationException($"Producto {p.Code} no tiene costo válido.");

                var calcReq = new PriceCalcRequest
                {
                    Cost = p.Cost,
                    CustomerId = customerId,
                    PaymentType = paymentType,
                    CreditTermId = paymentType == PaymentType.Credit ? creditTerm?.Id : null,
                    InstallmentsCount = paymentType == PaymentType.Installments ? installmentsCount : null,
                    InstallmentIntervalDays = paymentType == PaymentType.Installments ? intervalDays : null
                };

                var r = await _pricing.CalculateAsync(calcReq);
                lastMarkupPct = r.MarkupPctApplied;
                lastRuleInfo = r.RuleInfo;

                var unit = r.PriceSuggested;

                var discFactor = (100m - l.DiscountPercent) / 100m;
                var sub = Math.Round(l.Quantity * unit * discFactor, 2);

                var taxRate = tax?.Rate ?? 0m;
                var taxAmt = Math.Round(sub * (taxRate / 100m), 2);
                var total = sub + taxAmt;

                dto.Lines.Add(new SalesOrderPricingOptionLineDto
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    Quantity = l.Quantity,
                    CostUsed = p.Cost,
                    UnitPriceSuggested = unit,
                    DiscountPercent = l.DiscountPercent,
                    TaxId = l.TaxId,
                    TaxRate = taxRate,
                    LineSubTotal = sub,
                    LineTax = taxAmt,
                    LineTotal = total
                });
            }

            dto.MarkupPctApplied = lastMarkupPct;
            dto.RuleInfo = lastRuleInfo;

            dto.SubTotal = dto.Lines.Sum(x => x.LineSubTotal);
            dto.TaxTotal = dto.Lines.Sum(x => x.LineTax);
            dto.Total = dto.Lines.Sum(x => x.LineTotal);

            return dto;
        }

        // POST: api/salesorders
        [RequirePermission(Perms.SalesOrdersCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(SalesOrderCreateDto dto)
        {
            var orderDate = dto.OrderDate == default ? DateTime.UtcNow : dto.OrderDate;

            // ✅ PERIODO (igual a compras)
            if (!await _periods.HasOpenPeriodForDate(orderDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la orden de venta.");

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest("No se puede crear una OV sin líneas.");

            var customer = await _ctx.SociosNegocio.FirstOrDefaultAsync(s => s.Id == dto.CustomerId);
            if (customer == null) return BadRequest("Cliente no existe.");

            // cliente = C o A (Ambos)
            if (customer.PartnerType != "C" && customer.PartnerType != "A")
                return BadRequest("El socio seleccionado no es Cliente (PartnerType = 'C' o 'A').");

            var wh = await _ctx.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId);
            if (wh == null) return BadRequest("Depósito no existe.");

            // Validaciones básicas de líneas
            if (dto.Lines.Any(l => l.Quantity <= 0)) return BadRequest("Cantidad debe ser > 0.");
            if (dto.Lines.Any(l => l.UnitPrice < 0)) return BadRequest("Precio no puede ser negativo.");
            if (dto.Lines.Any(l => l.DiscountPercent < 0 || l.DiscountPercent > 100)) return BadRequest("Descuento inválido (línea).");

            // Validaciones descuento documento
            if (dto.DocumentDiscountPercent < 0 || dto.DocumentDiscountPercent > 100)
                return BadRequest("Descuento % de documento inválido (0..100).");

            if (dto.DocumentDiscountAmount < 0)
                return BadRequest("Descuento monto de documento inválido.");

            // Cargar productos involucrados
            var productIds = dto.Lines.Select(x => x.ProductId).Distinct().ToList();
            var products = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Count)
                return BadRequest("Uno o más productos no existen.");

            // impuestos
            var taxIds = dto.Lines.Where(x => x.TaxId.HasValue).Select(x => x.TaxId!.Value).Distinct().ToList();
            var taxes = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

            var doc = new SalesOrder
            {
                DocNumber = await GenerateNextDocNumber(),
                OrderDate = orderDate,
                CustomerId = customer.Id,
                CustomerName = customer.RazonSocial,
                WarehouseId = wh.Id,
                Status = "DRAFT",
                Comments = dto.Comments,

                // doc discounts (SAP style)
                DocumentDiscountPercent = dto.DocumentDiscountPercent,
                DocumentDiscountAmount = dto.DocumentDiscountAmount
            };

            // ============ cálculo descuentos doc SAP ============
            var tmpLines = new List<SalesOrderLine>();
            decimal subTotalBeforeDoc = 0m;

            foreach (var l in dto.Lines)
            {
                var p = products.First(x => x.Id == l.ProductId);

                var lineDiscFactor = (100m - l.DiscountPercent) / 100m;
                var lineNetBeforeDoc = Math.Round(l.Quantity * l.UnitPrice * lineDiscFactor, 2);

                subTotalBeforeDoc += lineNetBeforeDoc;

                tmpLines.Add(new SalesOrderLine
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    Quantity = l.Quantity,
                    UnitPrice = l.UnitPrice,
                    DiscountPercent = l.DiscountPercent,
                    TaxId = l.TaxId,

                    LineSubTotal = lineNetBeforeDoc,
                    LineTax = 0m,
                    LineTotal = 0m
                });
            }

            // descuento documento efectivo (prioriza monto si > 0)
            decimal docDiscountEffective = 0m;
            if (subTotalBeforeDoc > 0m)
            {
                if (dto.DocumentDiscountAmount > 0m)
                {
                    docDiscountEffective = Math.Min(dto.DocumentDiscountAmount, subTotalBeforeDoc);
                }
                else if (dto.DocumentDiscountPercent > 0m)
                {
                    docDiscountEffective = Math.Round(subTotalBeforeDoc * (dto.DocumentDiscountPercent / 100m), 2);
                    docDiscountEffective = Math.Min(docDiscountEffective, subTotalBeforeDoc);
                }
            }

            // prorrateo + impuestos
            decimal runningAllocated = 0m;

            for (int i = 0; i < tmpLines.Count; i++)
            {
                var line = tmpLines[i];
                var lineBase = line.LineSubTotal;

                decimal alloc = 0m;

                if (docDiscountEffective > 0m && subTotalBeforeDoc > 0m)
                {
                    if (i < tmpLines.Count - 1)
                    {
                        alloc = Math.Round(docDiscountEffective * (lineBase / subTotalBeforeDoc), 2);
                        runningAllocated += alloc;
                    }
                    else
                    {
                        alloc = Math.Round(docDiscountEffective - runningAllocated, 2);
                    }
                }

                var lineNetAfterDoc = Math.Round(lineBase - alloc, 2);
                if (lineNetAfterDoc < 0m) lineNetAfterDoc = 0m;

                var tax = line.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == line.TaxId.Value) : null;
                var taxRate = tax?.Rate ?? 0m;

                var taxAmt = Math.Round(lineNetAfterDoc * (taxRate / 100m), 2);
                var total = lineNetAfterDoc + taxAmt;

                line.LineSubTotal = lineNetAfterDoc;
                line.LineTax = taxAmt;
                line.LineTotal = total;
            }

            doc.Lines = tmpLines;

            doc.SubTotal = doc.Lines.Sum(x => x.LineSubTotal);
            doc.TaxTotal = doc.Lines.Sum(x => x.LineTax);
            doc.Total = doc.Lines.Sum(x => x.LineTotal);

            _ctx.SalesOrders.Add(doc);
            await _ctx.SaveChangesAsync();

            return Ok(doc);
        }

        // PUT: api/salesorders/5
        [RequirePermission(Perms.SalesOrdersEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, SalesOrderUpdateDto dto)
        {
            var doc = await _ctx.SalesOrders
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (doc == null) return NotFound();

            var newDate = dto.OrderDate == default ? doc.OrderDate : dto.OrderDate;

            // ✅ PERIODO (igual a compras)
            if (!await _periods.HasOpenPeriodForDate(newDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la orden de venta.");

            if (doc.Status != "DRAFT")
                return BadRequest("Solo se puede editar una OV en estado DRAFT.");

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest("No se puede dejar la OV sin líneas.");

            var customer = await _ctx.SociosNegocio.FirstOrDefaultAsync(s => s.Id == dto.CustomerId);
            if (customer == null) return BadRequest("Cliente no existe.");
            if (customer.PartnerType != "C" && customer.PartnerType != "A")
                return BadRequest("El socio seleccionado no es Cliente.");

            var wh = await _ctx.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId);
            if (wh == null) return BadRequest("Depósito no existe.");

            if (dto.Lines.Any(l => l.Quantity <= 0)) return BadRequest("Cantidad debe ser > 0.");
            if (dto.Lines.Any(l => l.UnitPrice < 0)) return BadRequest("Precio no puede ser negativo.");
            if (dto.Lines.Any(l => l.DiscountPercent < 0 || l.DiscountPercent > 100)) return BadRequest("Descuento inválido (línea).");

            if (dto.DocumentDiscountPercent < 0 || dto.DocumentDiscountPercent > 100)
                return BadRequest("Descuento % de documento inválido (0..100).");

            if (dto.DocumentDiscountAmount < 0)
                return BadRequest("Descuento monto de documento inválido.");

            var productIds = dto.Lines.Select(x => x.ProductId).Distinct().ToList();
            var products = await _ctx.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Count) return BadRequest("Uno o más productos no existen.");

            var taxIds = dto.Lines.Where(x => x.TaxId.HasValue).Select(x => x.TaxId!.Value).Distinct().ToList();
            var taxes = await _ctx.Taxes.Where(t => taxIds.Contains(t.Id)).ToListAsync();

            doc.OrderDate = newDate;
            doc.CustomerId = customer.Id;
            doc.CustomerName = customer.RazonSocial;
            doc.WarehouseId = wh.Id;
            doc.Comments = dto.Comments;

            doc.DocumentDiscountPercent = dto.DocumentDiscountPercent;
            doc.DocumentDiscountAmount = dto.DocumentDiscountAmount;

            doc.UpdatedAt = DateTime.UtcNow;

            _ctx.SalesOrderLines.RemoveRange(doc.Lines);
            doc.Lines.Clear();

            var tmpLines = new List<SalesOrderLine>();
            decimal subTotalBeforeDoc = 0m;

            foreach (var l in dto.Lines)
            {
                var p = products.First(x => x.Id == l.ProductId);

                var lineDiscFactor = (100m - l.DiscountPercent) / 100m;
                var lineNetBeforeDoc = Math.Round(l.Quantity * l.UnitPrice * lineDiscFactor, 2);

                subTotalBeforeDoc += lineNetBeforeDoc;

                tmpLines.Add(new SalesOrderLine
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    Quantity = l.Quantity,
                    UnitPrice = l.UnitPrice,
                    DiscountPercent = l.DiscountPercent,
                    TaxId = l.TaxId,

                    LineSubTotal = lineNetBeforeDoc,
                    LineTax = 0m,
                    LineTotal = 0m
                });
            }

            decimal docDiscountEffective = 0m;
            if (subTotalBeforeDoc > 0m)
            {
                if (dto.DocumentDiscountAmount > 0m)
                {
                    docDiscountEffective = Math.Min(dto.DocumentDiscountAmount, subTotalBeforeDoc);
                }
                else if (dto.DocumentDiscountPercent > 0m)
                {
                    docDiscountEffective = Math.Round(subTotalBeforeDoc * (dto.DocumentDiscountPercent / 100m), 2);
                    docDiscountEffective = Math.Min(docDiscountEffective, subTotalBeforeDoc);
                }
            }

            decimal runningAllocated = 0m;
            for (int i = 0; i < tmpLines.Count; i++)
            {
                var line = tmpLines[i];
                var lineBase = line.LineSubTotal;

                decimal alloc = 0m;

                if (docDiscountEffective > 0m && subTotalBeforeDoc > 0m)
                {
                    if (i < tmpLines.Count - 1)
                    {
                        alloc = Math.Round(docDiscountEffective * (lineBase / subTotalBeforeDoc), 2);
                        runningAllocated += alloc;
                    }
                    else
                    {
                        alloc = Math.Round(docDiscountEffective - runningAllocated, 2);
                    }
                }

                var lineNetAfterDoc = Math.Round(lineBase - alloc, 2);
                if (lineNetAfterDoc < 0m) lineNetAfterDoc = 0m;

                var tax = line.TaxId.HasValue ? taxes.FirstOrDefault(t => t.Id == line.TaxId.Value) : null;
                var taxRate = tax?.Rate ?? 0m;

                var taxAmt = Math.Round(lineNetAfterDoc * (taxRate / 100m), 2);
                var total = lineNetAfterDoc + taxAmt;

                line.LineSubTotal = lineNetAfterDoc;
                line.LineTax = taxAmt;
                line.LineTotal = total;
            }

            doc.Lines = tmpLines;

            doc.SubTotal = doc.Lines.Sum(x => x.LineSubTotal);
            doc.TaxTotal = doc.Lines.Sum(x => x.LineTax);
            doc.Total = doc.Lines.Sum(x => x.LineTotal);

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/salesorders/5/open
        [RequirePermission(Perms.SalesOrdersEdit)]
        [HttpPost("{id}/open")]
        public async Task<IActionResult> Open(int id)
        {
            var doc = await _ctx.SalesOrders.FindAsync(id);
            if (doc == null) return NotFound();

            if (!await _periods.HasOpenPeriodForDate(doc.OrderDate))
                return BadRequest("No existe un período ABIERTO para la fecha de la orden de venta.");

            if (doc.Status != "DRAFT") return BadRequest("Solo se puede abrir desde DRAFT.");

            doc.Status = "OPEN";
            doc.UpdatedAt = DateTime.UtcNow;
            await _ctx.SaveChangesAsync();
            return Ok(doc);
        }

        // POST: api/salesorders/5/close
        [RequirePermission(Perms.SalesOrdersEdit)]
        [HttpPost("{id}/close")]
        public async Task<IActionResult> Close(int id)
        {
            var doc = await _ctx.SalesOrders.FindAsync(id);
            if (doc == null) return NotFound();
            if (doc.Status != "OPEN") return BadRequest("Solo se puede cerrar desde OPEN.");

            doc.Status = "CLOSED";
            doc.UpdatedAt = DateTime.UtcNow;
            await _ctx.SaveChangesAsync();
            return Ok(doc);
        }

        // POST: api/salesorders/5/cancel
        [RequirePermission(Perms.SalesOrdersCancel)]
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            var doc = await _ctx.SalesOrders.FindAsync(id);
            if (doc == null) return NotFound();
            if (doc.Status == "CLOSED") return BadRequest("No se puede cancelar una OV cerrada.");

            doc.Status = "CANCELED";
            doc.UpdatedAt = DateTime.UtcNow;
            await _ctx.SaveChangesAsync();
            return Ok(doc);
        }

        private async Task<string> GenerateNextDocNumber()
        {
            var last = await _ctx.SalesOrders
                .OrderByDescending(x => x.Id)
                .Select(x => x.DocNumber)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(last))
                return "OV000001";

            var numPart = new string(last.Where(char.IsDigit).ToArray());
            if (!int.TryParse(numPart, out var n)) n = 0;

            n++;
            return $"OV{n:D6}";
        }

        // ==========================================
        // PREVIEW PDF (sin guardar)
        // POST: api/salesorders/quote-pdf-preview
        // ==========================================
        [RequirePermission(Perms.SalesOrdersView)]
        [HttpPost("quote-pdf-preview")]
        public async Task<IActionResult> QuotePdfPreview([FromBody] QuotePdfPreviewRequestDto req)
        {
            if (req == null) return BadRequest("Body requerido.");

            if (!req.IncludeCash && !req.IncludeCredit && !req.IncludeInstallments)
                return BadRequest("Seleccioná al menos un escenario.");

            if (req.CustomerId <= 0) return BadRequest("CustomerId inválido.");
            if (req.WarehouseId <= 0) return BadRequest("WarehouseId inválido.");

            if (req.DiscountPct < 0 || req.DiscountPct > 100)
                return BadRequest("DiscountPct debe estar entre 0 y 100.");

            if (req.Lines == null || req.Lines.Count == 0)
                return BadRequest("Agregá al menos 1 línea.");

            // Lookups (solo lectura)
            var customer = await _ctx.SociosNegocio
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == req.CustomerId);

            if (customer == null) return BadRequest("Cliente no existe.");

            var wh = await _ctx.Warehouses
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == req.WarehouseId);

            if (wh == null) return BadRequest("Depósito no existe.");

            // Productos usados
            var pids = req.Lines.Select(x => x.ProductId).Distinct().ToList();

            var products = await _ctx.Products
                .AsNoTracking()
                .Where(p => pids.Contains(p.Id))
                .ToListAsync();

            var prodMap = products.ToDictionary(x => x.Id, x => x);

            // Impuestos usados (línea o producto)
            var taxIds = new HashSet<int>();

            foreach (var l in req.Lines)
            {
                if (l.TaxId.HasValue) taxIds.Add(l.TaxId.Value);

                if (prodMap.TryGetValue(l.ProductId, out var pr))
                {
                    if (l.TaxId > 0) taxIds.Add((int)l.TaxId);
                }
            }

            var taxes = await _ctx.Taxes
                .AsNoTracking()
                .Where(t => taxIds.Contains(t.Id))
                .ToListAsync();

            var taxMap = taxes.ToDictionary(x => x.Id, x => x);

            // Escenarios
            var scenarios = new List<QuoteScenarioPreview>();

            if (req.IncludeCash)
                scenarios.Add(new QuoteScenarioPreview
                {
                    Title = "CONTADO",
                    PaymentType = PaymentType.Cash
                });

            if (req.IncludeCredit)
                scenarios.Add(new QuoteScenarioPreview
                {
                    Title = "CRÉDITO",
                    PaymentType = PaymentType.Credit,
                    CreditTermId = req.CreditTermId
                });

            if (req.IncludeInstallments)
                scenarios.Add(new QuoteScenarioPreview
                {
                    Title = "CUOTAS",
                    PaymentType = PaymentType.Installments,
                    InstallmentsCount = Math.Clamp(req.InstallmentsCount, 1, 12),
                    InstallmentIntervalDays = req.InstallmentIntervalDays ?? 30
                });

            // Calcular cada escenario
            foreach (var sc in scenarios)
                await ComputeScenarioPreviewAsync(req, sc, prodMap, taxMap);

            // QuestPDF
            QuestPDF.Settings.License = LicenseType.Community;

            var model = new QuotePreviewHeader
            {
                OrderDate = req.OrderDate,
                CustomerName = $"{(customer.Code ?? "")} {(customer.RazonSocial ?? "")}".Trim(),
                WarehouseName = wh.Name ?? "",
                Comments = req.Comments
            };

            var pdf = new QuotePdfPreviewDocument(model, scenarios, req.DiscountPct);
            var bytes = pdf.GeneratePdf();

            var fileName = $"COTIZACION_PREVIEW_{DateTime.Now:yyyyMMddHHmm}.pdf";
            return File(bytes, "application/pdf", fileName);
        }

        private async Task ComputeScenarioPreviewAsync(
            QuotePdfPreviewRequestDto req,
            QuoteScenarioPreview sc,
            Dictionary<int, Product> prodMap,
            Dictionary<int, Tax> taxMap)
        {
            var discFactor = (100m - req.DiscountPct) / 100m;

            decimal sub = 0m;
            decimal tax = 0m;

            sc.Lines = new List<QuoteScenarioLinePreview>();

            foreach (var l in req.Lines)
            {
                if (l.ProductId <= 0 || l.Quantity <= 0) continue;

                if (!prodMap.TryGetValue(l.ProductId, out var product))
                    continue;

                var isManual = (l.PriceSource ?? "")
                    .Equals("MANUAL", StringComparison.OrdinalIgnoreCase);

                decimal unit = l.UnitPrice;

                // Si NO es manual => recalcular por escenario (desde COSTO)
                if (!isManual)
                {
                    var cost = product.Cost;
                    if (cost > 0m)
                    {
                        var calcReq = new PriceCalcRequest
                        {
                            Cost = cost,
                            CustomerId = req.CustomerId,
                            PaymentType = sc.PaymentType,
                            CreditTermId = sc.PaymentType == PaymentType.Credit ? sc.CreditTermId : null,
                            InstallmentsCount = sc.PaymentType == PaymentType.Installments ? sc.InstallmentsCount : null,
                            InstallmentIntervalDays = sc.PaymentType == PaymentType.Installments ? sc.InstallmentIntervalDays : null
                        };

                        var r = await _pricing.CalculateAsync(calcReq);
                        unit = r.PriceSuggested;
                        sc.RuleInfo = r.RuleInfo;
                    }
                }

                // Impuesto (prioriza TaxId de línea, si no usa el del producto)
                int? tid = l.TaxId ?? product.TaxId;

                decimal rate = 0m;
                if (tid.HasValue && taxMap.TryGetValue(tid.Value, out var tx))
                {
                    // si Tax.Rate es nullable -> rate = tx.Rate ?? 0m;
                    rate = tx.Rate;
                }

                var lineDiscFactor = (100m - (l.DiscountPercent)) / 100m;

                var lineSub = RoundMoney(l.Quantity * unit * lineDiscFactor);
                lineSub = RoundMoney(lineSub * discFactor);

                var lineTax = RoundMoney(lineSub * (rate / 100m));
                var lineTotal = RoundMoney(lineSub + lineTax);

                sub += lineSub;
                tax += lineTax;

                sc.Lines.Add(new QuoteScenarioLinePreview
                {
                    Qty = l.Quantity,
                    ProductCode = product.Code ?? "",
                    Description = product.Name ?? "",
                    UnitPrice = unit,
                    LineTotal = lineTotal,
                    IsManual = isManual
                });
            }

            sc.SubTotal = RoundMoney(sub);
            sc.TaxTotal = RoundMoney(tax);
            sc.Total = RoundMoney(sub + tax);

            if (sc.PaymentType == PaymentType.Installments)
            {
                sc.Schedule = BuildInstallmentSchedule(
                    sc.Total,
                    req.OrderDate,
                    sc.InstallmentsCount ?? 12,
                    sc.InstallmentIntervalDays ?? 30
                );
            }
        }

        private static List<InstallmentRow> BuildInstallmentSchedule(decimal total, DateTime start, int n, int intervalDays)
        {
            n = Math.Clamp(n, 1, 120);
            intervalDays = Math.Max(1, intervalDays);

            // Math.Floor(decimal) devuelve decimal
            var baseAmt = Math.Floor(total / n);
            var remainder = total - (baseAmt * n);

            var list = new List<InstallmentRow>();
            for (int i = 1; i <= n; i++)
            {
                var due = start.Date.AddDays(intervalDays * i);
                var amt = baseAmt + (i == 1 ? remainder : 0m);
                list.Add(new InstallmentRow { N = i, DueDate = due, Amount = amt });
            }
            return list;
        }

        private static decimal RoundMoney(decimal v)
            => Math.Round(v, 0, MidpointRounding.AwayFromZero);

    }
}
