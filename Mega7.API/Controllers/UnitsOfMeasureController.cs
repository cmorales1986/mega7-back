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
    public class UnitsOfMeasureController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public UnitsOfMeasureController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var units = await _ctx.UnitsOfMeasure.ToListAsync();
            return Ok(units);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var unit = await _ctx.UnitsOfMeasure.FindAsync(id);
            if (unit == null)
                return NotFound();

            return Ok(unit);
        }


        [HttpPost]
        public async Task<IActionResult> Create(UnitOfMeasureCreateDto model)
        {
            // Validar duplicado de código
            if (await _ctx.UnitsOfMeasure.AnyAsync(u => u.Code == model.Code))
                return BadRequest("Ya existe una unidad con ese código.");

            var unit = new UnitOfMeasure
            {
                Code = model.Code,
                Name = model.Name,
                IsActive = model.IsActive
            };

            _ctx.UnitsOfMeasure.Add(unit);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = unit.Id }, unit);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UnitOfMeasureUpdateDto model)
        {
            var unit = await _ctx.UnitsOfMeasure.FindAsync(id);

            if (unit == null)
                return NotFound();

            // Validar que el código no se repita en otra unidad
            if (await _ctx.UnitsOfMeasure
                .AnyAsync(u => u.Code == model.Code && u.Id != id))
            {
                return BadRequest("Ya existe otra unidad con ese código.");
            }

            unit.Code = model.Code;
            unit.Name = model.Name;
            unit.IsActive = model.IsActive;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var unit = await _ctx.UnitsOfMeasure.FindAsync(id);

            if (unit == null)
                return NotFound();

            _ctx.UnitsOfMeasure.Remove(unit);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }
    }
}
