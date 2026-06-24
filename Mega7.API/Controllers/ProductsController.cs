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
    public class ProductsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public ProductsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/products
        [RequirePermission(Perms.ProductsView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.Products
                .Include(p => p.Brand)
                .Include(p => p.Category)
                .Include(p => p.SubCategory)
                .Include(p => p.UnitOfMeasure)
                .Include(p => p.Tax)
                .OrderBy(p => p.Name)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/products/5
        [RequirePermission(Perms.ProductsView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var product = await _ctx.Products
                .Include(p => p.Brand)
                .Include(p => p.Category)
                .Include(p => p.SubCategory)
                .Include(p => p.UnitOfMeasure)
                .Include(p => p.Tax)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            return Ok(product);
        }

        // POST: api/products
        [RequirePermission(Perms.ProductsCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(Product model)
        {
            // Validaciones especiales
            if (model.IsBatchManaged && model.IsSerialManaged)
                return BadRequest("El producto no puede ser loteable y serializable al mismo tiempo.");

            _ctx.Products.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        // PUT: api/products/5
        [RequirePermission(Perms.ProductsEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, Product model)
        {
            var product = await _ctx.Products.FindAsync(id);

            if (product == null)
                return NotFound();

            if (model.IsBatchManaged && model.IsSerialManaged)
                return BadRequest("El producto no puede ser loteable y serializable al mismo tiempo.");

            product.Code = model.Code;
            product.Name = model.Name;
            product.Barcode = model.Barcode;

            product.BrandId = model.BrandId;
            product.CategoryId = model.CategoryId;
            product.SubCategoryId = model.SubCategoryId;
            product.UnitOfMeasureId = model.UnitOfMeasureId;
            product.TaxId = model.TaxId;

            product.IsBatchManaged = model.IsBatchManaged;
            product.IsSerialManaged = model.IsSerialManaged;

            product.MinimumStock = model.MinimumStock;
            product.Price = model.Price;
            product.Cost = model.Cost;

            product.ImageUrl = model.ImageUrl;
            product.IsActive = model.IsActive;
            product.Description = model.Description;


            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/products/5
        [RequirePermission(Perms.ProductsDelete)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var product = await _ctx.Products.FindAsync(id);

            if (product == null)
                return NotFound();

            _ctx.Products.Remove(product);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/products/batch-serial
        [RequirePermission(Perms.ProductsView)]
        [HttpGet("batch-serial")]
        public async Task<IActionResult> GetBatchSerial()
        {
            var data = await _ctx.Products
                .OrderBy(p => p.Name)
                .Select(p => new ProductBatchSerialDto
                {
                    Id = p.Id,
                    Code = p.Code,
                    Name = p.Name,
                    IsBatchManaged = p.IsBatchManaged,
                    IsSerialManaged = p.IsSerialManaged,
                    IsActive = p.IsActive
                })
                .ToListAsync();

            return Ok(data);
        }

        // PUT: api/products/{id}/batch-serial
        [RequirePermission(Perms.ProductsEdit)]
        [HttpPut("{id}/batch-serial")]
        public async Task<IActionResult> UpdateBatchSerial(
            int id,
            ProductBatchSerialUpdateDto model)
        {
            var product = await _ctx.Products.FindAsync(id);

            if (product == null)
                return NotFound();

            if (model.IsBatchManaged && model.IsSerialManaged)
                return BadRequest("El producto no puede ser loteable y serializable al mismo tiempo.");

            product.IsBatchManaged = model.IsBatchManaged;
            product.IsSerialManaged = model.IsSerialManaged;
            product.IsActive = model.IsActive;

            await _ctx.SaveChangesAsync();

            return NoContent();
        }

    }
}
