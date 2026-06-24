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
    public class PaymentConceptsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public PaymentConceptsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/paymentconcepts?activeOnly=true
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = true)
        {
            var q = _ctx.PaymentConcepts.AsQueryable();

            if (activeOnly)
                q = q.Where(x => x.IsActive);

            var list = await q
                .OrderByDescending(x => x.IsDefault)
                .ThenBy(x => x.Name)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/paymentconcepts/5
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var item = await _ctx.PaymentConcepts.FindAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        // POST: api/paymentconcepts
        [HttpPost]
        public async Task<IActionResult> Create(PaymentConcept model)
        {
            model.Code = (model.Code ?? "").Trim().ToUpper();
            model.Name = (model.Name ?? "").Trim();

            if (string.IsNullOrWhiteSpace(model.Code))
                return BadRequest("Code es requerido.");
            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest("Name es requerido.");

            // unicidad
            var codeExists = await _ctx.PaymentConcepts.AnyAsync(x => x.Code == model.Code);
            if (codeExists) return BadRequest($"Ya existe el código {model.Code}.");

            var nameExists = await _ctx.PaymentConcepts.AnyAsync(x => x.Name == model.Name);
            if (nameExists) return BadRequest($"Ya existe el nombre {model.Name}.");

            // si marca default, apagar otros
            if (model.IsDefault)
            {
                var defaults = await _ctx.PaymentConcepts.Where(x => x.IsDefault).ToListAsync();
                foreach (var d in defaults) d.IsDefault = false;
            }

            _ctx.PaymentConcepts.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        // PUT: api/paymentconcepts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, PaymentConcept model)
        {
            var item = await _ctx.PaymentConcepts.FindAsync(id);
            if (item == null) return NotFound();

            var newCode = (model.Code ?? "").Trim().ToUpper();
            var newName = (model.Name ?? "").Trim();

            if (string.IsNullOrWhiteSpace(newCode))
                return BadRequest("Code es requerido.");
            if (string.IsNullOrWhiteSpace(newName))
                return BadRequest("Name es requerido.");

            var codeExists = await _ctx.PaymentConcepts.AnyAsync(x => x.Id != id && x.Code == newCode);
            if (codeExists) return BadRequest($"Ya existe el código {newCode}.");

            var nameExists = await _ctx.PaymentConcepts.AnyAsync(x => x.Id != id && x.Name == newName);
            if (nameExists) return BadRequest($"Ya existe el nombre {newName}.");

            if (model.IsDefault)
            {
                var defaults = await _ctx.PaymentConcepts.Where(x => x.IsDefault && x.Id != id).ToListAsync();
                foreach (var d in defaults) d.IsDefault = false;
            }

            item.Code = newCode;
            item.Name = newName;
            item.IsActive = model.IsActive;
            item.IsDefault = model.IsDefault;
            item.RequiresBusinessPartner = model.RequiresBusinessPartner;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/paymentconcepts/5  (hard delete opcional)
        // Recomendado: desactivar
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _ctx.PaymentConcepts.FindAsync(id);
            if (item == null) return NotFound();

            _ctx.PaymentConcepts.Remove(item);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/paymentconcepts/5/deactivate
        [HttpPost("{id}/deactivate")]
        public async Task<IActionResult> Deactivate(int id)
        {
            var item = await _ctx.PaymentConcepts.FindAsync(id);
            if (item == null) return NotFound();

            item.IsActive = false;
            if (item.IsDefault) item.IsDefault = false;

            await _ctx.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        // POST: api/paymentconcepts/5/activate
        [HttpPost("{id}/activate")]
        public async Task<IActionResult> Activate(int id)
        {
            var item = await _ctx.PaymentConcepts.FindAsync(id);
            if (item == null) return NotFound();

            item.IsActive = true;
            await _ctx.SaveChangesAsync();
            return Ok(new { ok = true });
        }
    }
}
