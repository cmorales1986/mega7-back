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
    public class SocioNegocioSucursalesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public SocioNegocioSucursalesController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        [HttpGet("socio/{socioId}")]
        public async Task<IActionResult> GetBySocio(int socioId)
        {
            var list = await _ctx.SocioNegocioSucursales
                .Where(x => x.SocioNegocioId == socioId)
                .ToListAsync();

            return Ok(list);
        }

        [HttpPost]
        public async Task<IActionResult> Create(SocioNegocioSucursal model)
        {
            _ctx.SocioNegocioSucursales.Add(model);
            await _ctx.SaveChangesAsync();
            return Ok(model);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, SocioNegocioSucursal model)
        {
            var suc = await _ctx.SocioNegocioSucursales.FindAsync(id);

            if (suc == null)
                return NotFound();

            suc.Nombre = model.Nombre;
            suc.Direccion = model.Direccion;
            suc.Ciudad = model.Ciudad;
            suc.Telefono = model.Telefono;
            suc.Contacto = model.Contacto;
            suc.IsActive = model.IsActive;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var suc = await _ctx.SocioNegocioSucursales.FindAsync(id);

            if (suc == null)
                return NotFound();

            _ctx.SocioNegocioSucursales.Remove(suc);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }
    }
}
