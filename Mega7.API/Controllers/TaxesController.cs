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
    public class TaxesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public TaxesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/taxes
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.Taxes
                .AsNoTracking()
                .OrderBy(t => t.Name)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/taxes/5
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var tax = await _ctx.Taxes
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == id);

            if (tax == null)
                return NotFound();

            return Ok(tax);
        }

        // POST: api/taxes
        [HttpPost]
        public async Task<IActionResult> Create(Tax model)
        {
            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest("El nombre del impuesto es obligatorio.");

            if (model.Rate < 0)
                return BadRequest("La tasa del impuesto no puede ser negativa.");

            // Evitar que te manden Id manual
            model.Id = 0;

            _ctx.Taxes.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        // PUT: api/taxes/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, Tax model)
        {
            var tax = await _ctx.Taxes.FindAsync(id);

            if (tax == null)
                return NotFound();

            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest("El nombre del impuesto es obligatorio.");

            if (model.Rate < 0)
                return BadRequest("La tasa del impuesto no puede ser negativa.");

            tax.Name = model.Name;
            tax.Rate = model.Rate;

            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/taxes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var tax = await _ctx.Taxes.FindAsync(id);

            if (tax == null)
                return NotFound();

            _ctx.Taxes.Remove(tax);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }
    }
}
