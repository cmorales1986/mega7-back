using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Mega7.SHARED.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SalesPricingController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly SalesPricingService _svc;

        public SalesPricingController(Mega7DbContext ctx, SalesPricingService svc)
        {
            _ctx = ctx;
            _svc = svc;
        }

        // ==========================
        // 1) CALCULAR
        // POST: api/salespricing/calculate
        // ==========================
        [HttpPost("calculate")]
        public async Task<IActionResult> Calculate([FromBody] PriceCalcRequest req)
        {
            var result = await _svc.CalculateAsync(req);
            return Ok(result);
        }

        // ==========================
        // 2) PARAMS (GLOBAL / POR CLIENTE)
        // ==========================

        // GET: api/salespricing/params/global
        [HttpGet("params/global")]
        public async Task<IActionResult> GetGlobalParams()
        {
            var p = await _ctx.SalesPricingParams
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CustomerId == null && x.IsActive);

            if (p == null) return Ok(null);

            return Ok(ToDto(p));
        }

        // GET: api/salespricing/params/customer/5
        [HttpGet("params/customer/{customerId:int}")]
        public async Task<IActionResult> GetCustomerParams(int customerId)
        {
            var p = await _ctx.SalesPricingParams
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CustomerId == customerId && x.IsActive);

            if (p == null) return Ok(null);

            return Ok(ToDto(p));
        }

        // POST: api/salespricing/params/global
        // crea o actualiza el global (DTO)
        [HttpPost("params/global")]
        public async Task<IActionResult> UpsertGlobalParams([FromBody] SalesPricingParamsUpsertDto dto)
        {
            if (dto == null) return BadRequest("Body inválido.");

            var existing = await _ctx.SalesPricingParams
                .FirstOrDefaultAsync(x => x.CustomerId == null && x.IsActive);

            if (existing == null)
            {
                var model = new SalesPricingParams
                {
                    CustomerId = null,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = null
                };

                ApplyDto(dto, model);
                _ctx.SalesPricingParams.Add(model);
            }
            else
            {
                ApplyDto(dto, existing);
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // POST: api/salespricing/params/customer/5
        // crea o actualiza override por cliente (DTO)
        [HttpPost("params/customer/{customerId:int}")]
        public async Task<IActionResult> UpsertCustomerParams(int customerId, [FromBody] SalesPricingParamsUpsertDto dto)
        {
            if (dto == null) return BadRequest("Body inválido.");

            var existing = await _ctx.SalesPricingParams
                .FirstOrDefaultAsync(x => x.CustomerId == customerId && x.IsActive);

            if (existing == null)
            {
                var model = new SalesPricingParams
                {
                    CustomerId = customerId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = null
                };

                ApplyDto(dto, model);
                _ctx.SalesPricingParams.Add(model);
            }
            else
            {
                ApplyDto(dto, existing);
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // DELETE (soft): api/salespricing/params/customer/5
        [HttpDelete("params/customer/{customerId:int}")]
        public async Task<IActionResult> DisableCustomerParams(int customerId)
        {
            var existing = await _ctx.SalesPricingParams
                .FirstOrDefaultAsync(x => x.CustomerId == customerId && x.IsActive);

            if (existing == null) return NotFound();

            existing.IsActive = false;
            existing.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // ==========================
        // 3) CREDIT TERM MARKUPS (GRILLA)
        // ==========================

        public class CreditTermMarkupRowDto
        {
            public int CreditTermId { get; set; }
            public string CreditTermName { get; set; } = "";
            public int Days { get; set; }

            public decimal? GlobalMarkupPct { get; set; }
            public decimal? CustomerMarkupPct { get; set; }

            // "effective" para mostrar en grilla (customer si existe, sino global, sino 0)
            public decimal EffectiveMarkupPct { get; set; }
        }

        // GET: api/salespricing/credit-term-markups?customerId=5
        [HttpGet("credit-term-markups")]
        public async Task<IActionResult> GetCreditTermMarkups([FromQuery] int? customerId)
        {
            var terms = await _ctx.CreditTerms
                .AsNoTracking()
                .Where(x => x.IsActive)
                .OrderBy(x => x.Days)
                .ToListAsync();

            var globalRules = await _ctx.CreditTermMarkups
                .AsNoTracking()
                .Where(x => x.IsActive && x.CustomerId == null)
                .ToListAsync();

            var customerRules = customerId.HasValue
                ? await _ctx.CreditTermMarkups
                    .AsNoTracking()
                    .Where(x => x.IsActive && x.CustomerId == customerId.Value)
                    .ToListAsync()
                : new List<CreditTermMarkup>();

            var rows = terms.Select(t =>
            {
                var g = globalRules.FirstOrDefault(r => r.CreditTermId == t.Id);
                var c = customerRules.FirstOrDefault(r => r.CreditTermId == t.Id);

                var effective = c?.MarkupPct ?? g?.MarkupPct ?? 0m;

                return new CreditTermMarkupRowDto
                {
                    CreditTermId = t.Id,
                    CreditTermName = t.Name,
                    Days = t.Days,
                    GlobalMarkupPct = g?.MarkupPct,
                    CustomerMarkupPct = c?.MarkupPct,
                    EffectiveMarkupPct = effective
                };
            }).ToList();

            return Ok(rows);
        }

        public class CreditTermMarkupUpsertDto
        {
            public int CreditTermId { get; set; }
            public decimal MarkupPct { get; set; }
            public bool IsActive { get; set; } = true;
        }

        // PUT: api/salespricing/credit-term-markups/bulk?customerId=5
        // Si customerId = null => actualiza global
        [HttpPut("credit-term-markups/bulk")]
        public async Task<IActionResult> BulkUpsertCreditTermMarkups(
            [FromQuery] int? customerId,
            [FromBody] List<CreditTermMarkupUpsertDto> items)
        {
            if (items == null) items = new();

            // normaliza (evitar duplicados en payload)
            items = items
                .GroupBy(x => x.CreditTermId)
                .Select(g => g.Last())
                .ToList();

            // traer existentes del scope
            var existing = await _ctx.CreditTermMarkups
                .Where(x => x.CustomerId == customerId && x.IsActive)
                .ToListAsync();

            foreach (var it in items)
            {
                var row = existing.FirstOrDefault(x => x.CreditTermId == it.CreditTermId);

                if (row == null)
                {
                    row = new CreditTermMarkup
                    {
                        CustomerId = customerId,
                        CreditTermId = it.CreditTermId,
                        MarkupPct = it.MarkupPct,
                        IsActive = it.IsActive,
                        CreatedAt = DateTime.UtcNow
                    };
                    _ctx.CreditTermMarkups.Add(row);
                }
                else
                {
                    row.MarkupPct = it.MarkupPct;
                    row.IsActive = it.IsActive;
                    row.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // DELETE (soft) ALL scope rules: api/salespricing/credit-term-markups/clear?customerId=5
        // Si customerId null => borra global
        [HttpDelete("credit-term-markups/clear")]
        public async Task<IActionResult> ClearCreditTermMarkups([FromQuery] int? customerId)
        {
            var list = await _ctx.CreditTermMarkups
                .Where(x => x.CustomerId == customerId && x.IsActive)
                .ToListAsync();

            foreach (var r in list)
            {
                r.IsActive = false;
                r.UpdatedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // ==========================
        // Helpers / Suggest price
        // ==========================

        [HttpPost("suggest-unit-price")]
        public async Task<IActionResult> SuggestUnitPrice([FromBody] SuggestUnitPriceRequestDto req)
        {
            if (req.ProductId <= 0)
                return BadRequest("ProductId inválido.");

            if (!Enum.IsDefined(typeof(PaymentType), req.PaymentType))
                return BadRequest("PaymentType inválido.");

            if (req.PaymentType == PaymentType.Credit && !req.CreditTermId.HasValue)
                return BadRequest("CreditTermId es requerido cuando PaymentType = Credit.");

            if (req.PaymentType == PaymentType.Installments)
            {
                if (!req.InstallmentsCount.HasValue || req.InstallmentsCount.Value <= 0)
                    return BadRequest("InstallmentsCount es requerido y debe ser > 0 cuando PaymentType = Installments.");
            }

            var product = await _ctx.Products.FirstOrDefaultAsync(p => p.Id == req.ProductId);
            if (product == null)
                return BadRequest("Producto no existe.");

            var cost = req.CostOverride ?? product.Cost;
            if (cost <= 0)
                return BadRequest("El producto no tiene costo válido (Cost <= 0).");

            var calcReq = new PriceCalcRequest
            {
                Cost = cost,
                CustomerId = req.CustomerId,
                PaymentType = req.PaymentType,
                CreditTermId = req.CreditTermId,
                InstallmentsCount = req.InstallmentsCount,
                InstallmentIntervalDays = req.InstallmentIntervalDays
            };

            var r = await _svc.CalculateAsync(calcReq);

            return Ok(new SuggestUnitPriceResultDto
            {
                ProductId = req.ProductId,
                CostUsed = cost,
                MarkupPctApplied = r.MarkupPctApplied,
                MarkupAmount = r.MarkupAmount,
                UnitPriceSuggested = r.PriceSuggested,
                RuleInfo = r.RuleInfo
            });
        }

        // ==========================
        // DTO mapping
        // ==========================

        private static SalesPricingParamsDto ToDto(SalesPricingParams p)
        {
            return new SalesPricingParamsDto
            {
                CustomerId = p.CustomerId,
                CashMarkupPct = p.CashMarkupPct,
                CreditDefaultMarkupPct = p.CreditDefaultMarkupPct,
                InstallmentDefaultMarkupPct = p.InstallmentDefaultMarkupPct,
                LateFeeAmountPerDay = p.LateFeeAmountPerDay,
                LateFeeGraceDays = p.LateFeeGraceDays,
                LateFeeCapAmount = p.LateFeeCapAmount
            };
        }

        private static void ApplyDto(SalesPricingParamsUpsertDto dto, SalesPricingParams entity)
        {
            entity.CashMarkupPct = dto.CashMarkupPct;
            entity.CreditDefaultMarkupPct = dto.CreditDefaultMarkupPct;
            entity.InstallmentDefaultMarkupPct = dto.InstallmentDefaultMarkupPct;

            entity.LateFeeAmountPerDay = dto.LateFeeAmountPerDay;
            entity.LateFeeGraceDays = dto.LateFeeGraceDays;
            entity.LateFeeCapAmount = dto.LateFeeCapAmount;

            entity.IsActive = true;
        }
    }
}
