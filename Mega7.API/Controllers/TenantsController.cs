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
    public class TenantsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public TenantsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // ✅ Para hoy: obtener “la empresa activa” (la primera activa)
        [HttpGet("active")]
        public async Task<IActionResult> GetActive()
        {
            var tenant = await _ctx.Tenants
                .Where(t => t.IsActive)
                .OrderBy(t => t.Id)
                .FirstOrDefaultAsync();

            if (tenant == null)
                return NotFound("No hay empresa configurada.");

            return Ok(tenant);
        }

        // ✅ Upsert simple: si no existe, crea; si existe, actualiza
        [HttpPost("active")]
        public async Task<IActionResult> UpsertActive(Tenant model)
        {
            var tenant = await _ctx.Tenants
                .Where(t => t.IsActive)
                .OrderBy(t => t.Id)
                .FirstOrDefaultAsync();

            if (tenant == null)
            {
                model.IsActive = true;
                _ctx.Tenants.Add(model);
                await _ctx.SaveChangesAsync();
                return Ok(model);
            }

            tenant.Name = model.Name;
            tenant.RUC = model.RUC;
            tenant.Address = model.Address;
            tenant.Email = model.Email;
            tenant.Phone = model.Phone;

            // futuro (si mandás)
            tenant.LogoUrl = model.LogoUrl;
            tenant.PrimaryColor = model.PrimaryColor;
            tenant.SecondaryColor = model.SecondaryColor;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }
    }
}
