using Mega7.API.Data;
using Mega7.API.DTOs;
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
    public class CategoriesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public CategoriesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/categories
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.Categories
                                 .OrderBy(c => c.Name)
                                 .ToListAsync();

            return Ok(list);
        }

        // GET: api/categories/5
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var category = await _ctx.Categories.FindAsync(id);

            if (category == null)
                return NotFound();

            return Ok(category);
        }

        // POST: api/categories
        [HttpPost]
        public async Task<IActionResult> Create(CategoryCreateDto dto)
        {
            var last = await _ctx.Categories
                                 .OrderByDescending(c => c.Id)
                                 .FirstOrDefaultAsync();

            int next = last == null ? 1 : last.Id + 1;

            var model = new Category
            {
                Name = dto.Name,
                Code = $"CG{next:D3}",
                IsActive = true
            };

            _ctx.Categories.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }



        // PUT: api/categories/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, CategoryUpdateDto model)
        {
            var category = await _ctx.Categories.FindAsync(id);

            if (category == null)
                return NotFound();

            category.Name = model.Name;
            category.IsActive = model.IsActive;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }


        // DELETE: api/categories/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var category = await _ctx.Categories.FindAsync(id);

            if (category == null)
                return NotFound();

            _ctx.Categories.Remove(category);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }

    }
}
