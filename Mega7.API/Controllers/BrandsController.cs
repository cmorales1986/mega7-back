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
    public class BrandsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public BrandsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/brands
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.Brands
                .OrderBy(b => b.Name)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/brands/5
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var brand = await _ctx.Brands.FindAsync(id);

            if (brand == null)
                return NotFound();

            return Ok(brand);
        }

        // POST: api/brands
        [HttpPost]
        public async Task<IActionResult> Create(BrandCreateDto model)
        {
            // Validar duplicado de nombre
            if (await _ctx.Brands.AnyAsync(b => b.Name == model.Name))
            {
                return BadRequest("Ya existe una marca con ese nombre.");
            }

            var brand = new Brand
            {
                Name = model.Name,
                IsActive = model.IsActive
            };

            _ctx.Brands.Add(brand);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = brand.Id }, brand);
        }

        // PUT: api/brands/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, BrandUpdateDto model)
        {
            var brand = await _ctx.Brands.FindAsync(id);

            if (brand == null)
                return NotFound();

            // Validar nombre duplicado en otra marca
            if (await _ctx.Brands
                .AnyAsync(b => b.Name == model.Name && b.Id != id))
            {
                return BadRequest("Ya existe otra marca con ese nombre.");
            }

            brand.Name = model.Name;
            brand.IsActive = model.IsActive;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/brands/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var brand = await _ctx.Brands.FindAsync(id);

            if (brand == null)
                return NotFound();

            _ctx.Brands.Remove(brand);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }
    }
}
