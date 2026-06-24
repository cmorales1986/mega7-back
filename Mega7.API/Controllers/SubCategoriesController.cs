using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Utils;
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
    public class SubCategoriesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public SubCategoriesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/subcategories
        [RequirePermission(Perms.SubCategoriesView)]
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var data = await _ctx.SubCategories
                .AsNoTracking()
                .Include(x => x.Category)
                .OrderBy(x => x.Name)
                .Select(x => new {
                    x.Id,
                    x.Code,
                    x.Name,
                    x.IsActive,
                    x.CategoryId, // ✅ ESTO FALTABA
                    Category = new
                    {
                        x.Category.Id,
                        x.Category.Name
                    }
                })
                .ToListAsync();

            return Ok(data);
        }



        // GET: api/subcategories/category/2 (listar las subcategorías por categoría)
        [RequirePermission(Perms.SubCategoriesView)]
        [HttpGet("category/{categoryId}")]
        public async Task<IActionResult> GetByCategory(int categoryId)
        {
            var list = await _ctx.SubCategories
                        .Where(x => x.CategoryId == categoryId)
                        .OrderBy(x => x.Name)
                        .ToListAsync();

            return Ok(list);
        }

        // GET: api/subcategories/5
        [RequirePermission(Perms.SubCategoriesView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var subCategory = await _ctx.SubCategories
                .Include(x => x.Category)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (subCategory == null)
                return NotFound();

            return Ok(subCategory);
        }

        // POST: api/subcategories
        [RequirePermission(Perms.SubCategoriesCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(SubCategoryCreateDto dto)
        {
            // Validar categoría existente
            var category = await _ctx.Categories.FindAsync(dto.CategoryId);

            if (category == null)
                return BadRequest("La categoría no existe.");

            // Obtener último ID o código para generar el siguiente
            var last = await _ctx.SubCategories
                                 .OrderByDescending(s => s.Id)
                                 .FirstOrDefaultAsync();

            int next = last == null ? 1 : last.Id + 1;

            string newCode = $"SC{next:D3}"; // SC001, SC002, etc.

            // Crear entidad
            var entity = new SubCategory
            {
                Code = newCode,
                Name = dto.Name,
                IsActive = dto.IsActive,
                CategoryId = dto.CategoryId
            };

            _ctx.SubCategories.Add(entity);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = entity.Id }, entity);
        }



        // PUT: api/subcategories/5
        [RequirePermission(Perms.SubCategoriesEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, SubCategoryUpdateDto model)
        {
            var subCategory = await _ctx.SubCategories.FindAsync(id);

            if (subCategory == null)
                return NotFound();

            var category = await _ctx.Categories.FindAsync(model.CategoryId);
            if (category == null)
                return BadRequest("La categoría no existe.");

            // NO tocamos el Code
            subCategory.Name = model.Name;
            subCategory.IsActive = model.IsActive;
            subCategory.CategoryId = model.CategoryId;

            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/subcategories/5
        [RequirePermission(Perms.SubCategoriesDelete)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var subCategory = await _ctx.SubCategories.FindAsync(id);

            if (subCategory == null)
                return NotFound();

            _ctx.SubCategories.Remove(subCategory);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }
    }
}
