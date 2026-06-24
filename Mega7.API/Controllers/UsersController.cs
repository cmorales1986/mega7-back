using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Utils;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Mega7.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMIN")]
    public class UsersController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public UsersController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // -----------------------------
        // GET: api/users
        // -----------------------------
        [RequirePermission(Perms.UsersView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var data = await _ctx.Users
                .OrderBy(u => u.Username)
                .Select(u => new
                {
                    u.Id,
                    u.Username,
                    u.FullName,
                    u.Email,
                    u.IsActive,
                    Role = (u.Role ?? "VENTAS").ToUpper()
                })
                .ToListAsync();

            return Ok(data);
        }

        // -----------------------------
        // GET: api/users/{id}
        // -----------------------------
        [RequirePermission(Perms.UsersView)]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var u = await _ctx.Users.FindAsync(id);
            if (u == null) return NotFound();

            return Ok(new
            {
                u.Id,
                u.Username,
                u.FullName,
                u.Email,
                u.IsActive,
                Role = (u.Role ?? "VENTAS").ToUpper()
            });
        }

        // -----------------------------
        // PUT: api/users/{id}/role
        // Body: { "role": "CAJERO" }
        // -----------------------------
        public record ChangeRoleRequest(string Role);

        [RequirePermission(Perms.UsersEdit)]
        [HttpPut("{id:int}/role")]
        public async Task<IActionResult> ChangeRole(int id, ChangeRoleRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Role))
                return BadRequest("Role es requerido.");

            var role = req.Role.Trim().ToUpperInvariant();

            // Valida contra los roles registrados en la tabla AppRoles
            if (!await _ctx.AppRoles.AnyAsync(r => r.Name == role))
                return BadRequest($"Rol '{role}' no existe. Crealo primero en la gestión de roles.");

            var u = await _ctx.Users.FindAsync(id);
            if (u == null) return NotFound();

            u.Role = role;
            await _ctx.SaveChangesAsync();

            return Ok(new { ok = true, role });
        }

        // -----------------------------
        // PUT: api/users/{id}/active
        // Body: { "isActive": true }
        // -----------------------------
        public record ChangeActiveRequest(bool IsActive);

        [RequirePermission(Perms.UsersDeactivate)]
        [HttpPut("{id:int}/active")]
        public async Task<IActionResult> ChangeActive(int id, ChangeActiveRequest req)
        {
            var u = await _ctx.Users.FindAsync(id);
            if (u == null) return NotFound();

            u.IsActive = req.IsActive;

            // Si lo desactivás, anulá refresh token
            if (!u.IsActive)
            {
                u.RefreshTokenHash = null;
                u.RefreshTokenExpiresAt = null;
            }

            await _ctx.SaveChangesAsync();

            return Ok(new { ok = true, isActive = u.IsActive });
        }

        // -----------------------------
        // DELETE: api/users/{id}
        // (opcional, yo prefiero desactivar)
        // -----------------------------
        [RequirePermission(Perms.UsersDeactivate)]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var u = await _ctx.Users.FindAsync(id);
            if (u == null) return NotFound();

            // Evitar borrar el último ADMIN (regla simple)
            var role = (u.Role ?? "").ToUpperInvariant();
            if (role == "ADMIN")
            {
                var adminCount = await _ctx.Users.CountAsync(x => (x.Role ?? "").ToUpper() == "ADMIN" && x.IsActive);
                if (adminCount <= 1)
                    return BadRequest("No se puede eliminar el último usuario ADMIN activo.");
            }

            _ctx.Users.Remove(u);
            await _ctx.SaveChangesAsync();

            return Ok(new { ok = true });
        }

        [RequirePermission(Perms.UsersEdit)]
        [HttpPost("{id:int}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id)
        {
            var u = await _ctx.Users.FirstOrDefaultAsync(x => x.Id == id);
            if (u == null) return NotFound();

            var role = (u.Role ?? "").ToUpperInvariant();
            if (role == "ADMIN")
            {
                var adminCount = await _ctx.Users.CountAsync(x => (x.Role ?? "").ToUpper() == "ADMIN" && x.IsActive);
                if (adminCount <= 1)
                    return BadRequest("No se puede resetear el último ADMIN activo.");
            }

            var tempPassword = GenerateTempPassword();

            u.PasswordHash = PasswordHasher.Hash(tempPassword);
            u.PasswordLastChangedAt = DateTime.UtcNow;
            u.MustChangePassword = true;

            u.RefreshTokenHash = null;
            u.RefreshTokenExpiresAt = null;

            await _ctx.SaveChangesAsync();

            return Ok(new { tempPassword });
        }

        private static string GenerateTempPassword()
        {
            var bytes = RandomNumberGenerator.GetBytes(8);
            var token = Convert.ToBase64String(bytes)
                .Replace("+", "")
                .Replace("/", "")
                .Replace("=", "");

            return $"M7A{DateTime.UtcNow:dd}{token}9";
        }
    }
}
