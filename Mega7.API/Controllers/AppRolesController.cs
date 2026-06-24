using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize(Roles = "ADMIN")]
    [ApiController]
    [Route("api/approles")]
    public class AppRolesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public AppRolesController(Mega7DbContext ctx) => _ctx = ctx;

        // GET api/approles
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var roles = await _ctx.AppRoles
                .AsNoTracking()
                .OrderBy(r => r.Name)
                .ToListAsync();

            // adjuntar conteo de usuarios por rol
            var usersPerRole = await _ctx.Users
                .Where(u => u.Role != null)
                .GroupBy(u => u.Role!)
                .Select(g => new { Role = g.Key.ToUpper(), Count = g.Count() })
                .ToDictionaryAsync(x => x.Role, x => x.Count);

            var result = roles.Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                r.IsSystem,
                r.CreatedAt,
                UserCount = usersPerRole.TryGetValue(r.Name.ToUpper(), out var c) ? c : 0,
            });

            return Ok(result);
        }

        // POST api/approles
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRoleDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre del rol es obligatorio.");

            var name = dto.Name.Trim().ToUpperInvariant();

            if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^[A-Z0-9_]{2,30}$"))
                return BadRequest("El nombre debe tener entre 2 y 30 caracteres (letras mayúsculas, números, guión bajo).");

            if (await _ctx.AppRoles.AnyAsync(r => r.Name == name))
                return BadRequest($"El rol '{name}' ya existe.");

            var role = new AppRole
            {
                Name        = name,
                Description = dto.Description?.Trim(),
                IsSystem    = false,
                CreatedAt   = DateTime.UtcNow,
            };

            _ctx.AppRoles.Add(role);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { }, new { role.Id, role.Name, role.Description, role.IsSystem });
        }

        // PUT api/approles/{id}
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleDto dto)
        {
            var role = await _ctx.AppRoles.FindAsync(id);
            if (role == null) return NotFound();

            if (role.IsSystem)
                return BadRequest("Los roles del sistema no se pueden modificar.");

            if (!string.IsNullOrWhiteSpace(dto.Description))
                role.Description = dto.Description.Trim();

            await _ctx.SaveChangesAsync();
            return Ok(new { role.Id, role.Name, role.Description });
        }

        // DELETE api/approles/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var role = await _ctx.AppRoles.FindAsync(id);
            if (role == null) return NotFound();

            if (role.IsSystem)
                return BadRequest("Los roles del sistema no se pueden eliminar.");

            var inUse = await _ctx.Users.AnyAsync(u => u.Role != null && u.Role.ToUpper() == role.Name.ToUpper());
            if (inUse)
                return BadRequest($"No se puede eliminar el rol '{role.Name}': está asignado a uno o más usuarios. Cambiá sus roles primero.");

            // Quitar también sus permisos
            var rps = await _ctx.RolePermissions.Where(rp => rp.RoleName == role.Name).ToListAsync();
            _ctx.RolePermissions.RemoveRange(rps);

            _ctx.AppRoles.Remove(role);
            await _ctx.SaveChangesAsync();

            return Ok(new { ok = true });
        }
    }

    public record CreateRoleDto(string Name, string? Description);
    public record UpdateRoleDto(string? Description);
}
