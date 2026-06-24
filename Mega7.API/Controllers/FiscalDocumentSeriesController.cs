using Mega7.API.Data;
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
    public class FiscalDocumentSeriesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public FiscalDocumentSeriesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? documentType = null, [FromQuery] bool onlyActive = false)
        {
            var q = _ctx.Set<FiscalDocumentSeries>().AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(documentType))
                q = q.Where(x => x.DocumentType == documentType.Trim().ToUpper());

            if (onlyActive) q = q.Where(x => x.IsActive);

            var list = await q.OrderByDescending(x => x.Id).ToListAsync();
            return Ok(list);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var x = await _ctx.Set<FiscalDocumentSeries>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (x == null) return NotFound();
            return Ok(x);
        }

        [HttpPost]
        public async Task<IActionResult> Create(FiscalDocumentSeriesUpsertDto dto)
        {
            var e = new FiscalDocumentSeries
            {
                DocumentType = (dto.DocumentType ?? "FACTURA").Trim().ToUpperInvariant(),
                TimbradoNumber = dto.TimbradoNumber?.Trim() ?? "",
                ValidFrom = dto.ValidFrom.Date,
                ValidTo = dto.ValidTo.Date,
                Establishment = (dto.Establishment ?? "001").Trim(),
                ExpeditionPoint = (dto.ExpeditionPoint ?? "001").Trim(),
                SeriesName = string.IsNullOrWhiteSpace(dto.SeriesName) ? null : dto.SeriesName.Trim(),
                RangeFrom = dto.RangeFrom,
                RangeTo = dto.RangeTo,
                NextNumber = dto.NextNumber,
                IsActive = dto.IsActive,
                Location = dto.Location
            };

            if (e.RangeFrom <= 0 || e.RangeTo <= 0 || e.RangeFrom > e.RangeTo)
                return BadRequest("Rango inválido.");

            if (e.NextNumber < e.RangeFrom) e.NextNumber = e.RangeFrom;

            _ctx.Add(e);
            await _ctx.SaveChangesAsync();
            return Ok(e);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, FiscalDocumentSeriesUpsertDto dto)
        {
            var e = await _ctx.Set<FiscalDocumentSeries>().FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound();

            e.DocumentType = (dto.DocumentType ?? e.DocumentType).Trim().ToUpperInvariant();
            e.TimbradoNumber = dto.TimbradoNumber?.Trim() ?? e.TimbradoNumber;
            e.ValidFrom = dto.ValidFrom.Date;
            e.ValidTo = dto.ValidTo.Date;
            e.Establishment = (dto.Establishment ?? e.Establishment).Trim();
            e.ExpeditionPoint = (dto.ExpeditionPoint ?? e.ExpeditionPoint).Trim();
            e.SeriesName = string.IsNullOrWhiteSpace(dto.SeriesName) ? null : dto.SeriesName.Trim();
            e.RangeFrom = dto.RangeFrom;
            e.RangeTo = dto.RangeTo;
            e.NextNumber = dto.NextNumber;
            e.IsActive = dto.IsActive;
            e.Location = dto.Location;
            e.UpdatedAt = DateTime.UtcNow;

            if (e.RangeFrom <= 0 || e.RangeTo <= 0 || e.RangeFrom > e.RangeTo)
                return BadRequest("Rango inválido.");

            if (e.NextNumber < e.RangeFrom) e.NextNumber = e.RangeFrom;

            await _ctx.SaveChangesAsync();
            return Ok(e);
        }
    }
}
