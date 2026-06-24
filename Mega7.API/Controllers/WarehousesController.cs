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
    public class WarehousesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public WarehousesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/warehouses
        [RequirePermission(Perms.WarehousesView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.Warehouses
                                 .OrderBy(x => x.Name)
                                 .ToListAsync();

            return Ok(list);
        }

        // GET: api/warehouses/5
        [RequirePermission(Perms.WarehousesView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var warehouse = await _ctx.Warehouses.FindAsync(id);

            if (warehouse == null)
                return NotFound();

            return Ok(warehouse);
        }

        // POST: api/warehouses
        [RequirePermission(Perms.WarehousesCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(WarehouseCreateDto model)
        {
            // Código único
            if (await _ctx.Warehouses.AnyAsync(w => w.Code == model.Code))
            {
                return BadRequest("Ya existe un almacén con ese código.");
            }

            var warehouse = new Warehouse
            {
                Code = model.Code,
                Name = model.Name,
                Address = model.Address ?? string.Empty,
                Phone = model.Phone ?? string.Empty,
                IsActive = model.IsActive
            };

            _ctx.Warehouses.Add(warehouse);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = warehouse.Id }, warehouse);
        }

        // PUT: api/warehouses/5
        [RequirePermission(Perms.WarehousesEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, WarehouseUpdateDto model)
        {
            var warehouse = await _ctx.Warehouses.FindAsync(id);

            if (warehouse == null)
                return NotFound();

            // Validar código único (excluyendo el mismo id)
            if (await _ctx.Warehouses
                .AnyAsync(w => w.Id != id && w.Code == model.Code))
            {
                return BadRequest("Ya existe otro almacén con ese código.");
            }

            warehouse.Code = model.Code;
            warehouse.Name = model.Name;
            warehouse.Address = model.Address ?? string.Empty;
            warehouse.Phone = model.Phone ?? string.Empty;
            warehouse.IsActive = model.IsActive;

            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/warehouses/5
        [RequirePermission(Perms.WarehousesDelete)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var warehouse = await _ctx.Warehouses.FindAsync(id);

            if (warehouse == null)
                return NotFound();

            _ctx.Warehouses.Remove(warehouse);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }
    }
}
