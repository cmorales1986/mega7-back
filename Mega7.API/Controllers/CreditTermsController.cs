using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CreditTermsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public CreditTermsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/creditterms
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.CreditTerms
                .OrderBy(x => x.Days)
                .ThenBy(x => x.Name)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/creditterms/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var item = await _ctx.CreditTerms.FirstOrDefaultAsync(x => x.Id == id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        // POST: api/creditterms
        [HttpPost]
        public async Task<IActionResult> Create(CreditTerm model)
        {
            model.Name = (model.Name ?? "").Trim();

            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest("Nombre es obligatorio.");

            if (model.Days < 0)
                return BadRequest("Days no puede ser negativo.");

            // evitar duplicados por Days
            if (await _ctx.CreditTerms.AnyAsync(x => x.Days == model.Days))
                return BadRequest("Ya existe un término con esa cantidad de días.");

            _ctx.CreditTerms.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        // PUT: api/creditterms/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, CreditTerm model)
        {
            var item = await _ctx.CreditTerms.FindAsync(id);
            if (item == null) return NotFound();

            var name = (model.Name ?? "").Trim();

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest("Nombre es obligatorio.");

            if (model.Days < 0)
                return BadRequest("Days no puede ser negativo.");

            if (await _ctx.CreditTerms.AnyAsync(x => x.Days == model.Days && x.Id != id))
                return BadRequest("Ya existe un término con esa cantidad de días.");

            item.Name = name;
            item.Days = model.Days;
            item.IsActive = model.IsActive;
            item.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/creditterms/5
        // (Recomendado: desactivar, no borrar)
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _ctx.CreditTerms.FindAsync(id);
            if (item == null) return NotFound();

            // soft delete
            item.IsActive = false;
            item.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }
    }
}
