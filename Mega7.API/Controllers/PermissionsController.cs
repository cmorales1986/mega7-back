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
    public class PermissionsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public PermissionsController(Mega7DbContext ctx) => _ctx = ctx;

        // GET api/permissions — lista todos los permisos del sistema
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var perms = await _ctx.Permissions
                .OrderBy(p => p.SortOrder)
                .Select(p => new { p.Id, p.Code, p.Module, p.Action, p.DisplayName, p.Group, p.SortOrder })
                .ToListAsync();

            return Ok(perms);
        }

        // GET api/permissions/role/{roleName} — permisos asignados a un rol
        [HttpGet("role/{roleName}")]
        public async Task<IActionResult> GetByRole(string roleName)
        {
            var codes = await _ctx.RolePermissions
                .Where(rp => rp.RoleName == roleName)
                .Select(rp => rp.Permission.Code)
                .ToListAsync();

            return Ok(new { roleName, permissions = codes });
        }

        // GET api/permissions/roles — todos los roles conocidos del sistema
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            var roles = await _ctx.AppRoles
                .AsNoTracking()
                .OrderBy(r => r.Name)
                .Select(r => r.Name)
                .ToListAsync();

            return Ok(roles);
        }

        // PUT api/permissions/role/{roleName} — reemplaza los permisos de un rol
        [HttpPut("role/{roleName}")]
        public async Task<IActionResult> SetRolePermissions(string roleName, [FromBody] SetRolePermissionsDto dto)
        {
            if (roleName.ToUpperInvariant() == "ADMIN")
                return BadRequest("El rol ADMIN no puede ser restringido.");

            await using var trx = await _ctx.Database.BeginTransactionAsync();
            try
            {
                // Borrar los permisos actuales del rol
                var existing = await _ctx.RolePermissions
                    .Where(rp => rp.RoleName == roleName)
                    .ToListAsync();
                _ctx.RolePermissions.RemoveRange(existing);

                // Insertar los nuevos
                if (dto.PermissionCodes?.Count > 0)
                {
                    var permIds = await _ctx.Permissions
                        .Where(p => dto.PermissionCodes.Contains(p.Code))
                        .ToDictionaryAsync(p => p.Code, p => p.Id);

                    foreach (var code in dto.PermissionCodes.Distinct())
                    {
                        if (permIds.TryGetValue(code, out var permId))
                        {
                            _ctx.RolePermissions.Add(new RolePermission
                            {
                                RoleName     = roleName,
                                PermissionId = permId,
                            });
                        }
                    }
                }

                await _ctx.SaveChangesAsync();
                await trx.CommitAsync();

                return Ok(new { ok = true, roleName, count = dto.PermissionCodes?.Count ?? 0 });
            }
            catch (Exception ex)
            {
                await trx.RollbackAsync();
                return BadRequest(ex.Message);
            }
        }
    }

    public record SetRolePermissionsDto(List<string>? PermissionCodes);
}
