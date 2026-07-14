using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.DTOs;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly JwtService _jwt;

        public AuthController(Mega7DbContext ctx, JwtService jwt)
        {
            _ctx = ctx;
            _jwt = jwt;
        }

        // ---------------------------------------------------------
        // 🔵 LOGIN
        // ---------------------------------------------------------
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            if (request == null)
                return BadRequest("Request inválido.");

            var userOrEmail = (request.UserOrEmail ?? "").Trim();
            var password = request.Password ?? "";

            if (string.IsNullOrWhiteSpace(userOrEmail) || string.IsNullOrWhiteSpace(password))
                return BadRequest("Usuario/Email y contraseña son requeridos.");

            var uoe = userOrEmail.ToLower();

            var user = await _ctx.Users.FirstOrDefaultAsync(u =>
                u.Username.ToLower() == uoe || u.Email.ToLower() == uoe);

            if (user == null) return BadRequest("Usuario no encontrado.");
            if (!user.IsActive) return BadRequest("Usuario inactivo.");

            if (!PasswordHasher.Verify(password, user.PasswordHash))
                return BadRequest("Contraseña incorrecta.");

            const int PASSWORD_EXP_DAYS = 90;

            var last = user.PasswordLastChangedAt ?? DateTime.UtcNow.AddDays(-PASSWORD_EXP_DAYS - 1);
            var expiresAt = last.AddDays(PASSWORD_EXP_DAYS);
            var daysLeft = (int)Math.Floor((expiresAt - DateTime.UtcNow).TotalDays);

            var expired = DateTime.UtcNow >= expiresAt;
            if (expired && !user.MustChangePassword)
            {
                user.MustChangePassword = true;
                await _ctx.SaveChangesAsync();
            }

            user.Role = (user.Role ?? "VENTAS").ToUpperInvariant();

            var perms = await LoadPermissionsAsync(user.Role);

            var accessToken = _jwt.GenerateAccessToken(user, perms);
            var refreshToken = _jwt.GenerateRefreshToken();

            user.RefreshTokenHash = PasswordHasher.Hash(refreshToken);
            user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);

            await _ctx.SaveChangesAsync();

            SetAuthCookies(accessToken, refreshToken);

            return Ok(new
            {
                user.Id,
                user.Username,
                user.FullName,
                user.Email,
                role = user.Role,
                mustChangePassword = user.MustChangePassword || expired,
                passwordExpiresAt = expiresAt,
                passwordDaysLeft = daysLeft,
                permissions = perms
            });
        }

        // ---------------------------------------------------------
        // 🔵 ENDPOINT: DATOS DEL USUARIO LOGUEADO
        // ---------------------------------------------------------

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var uid = User.FindFirst("uid")?.Value;

            if (string.IsNullOrWhiteSpace(uid))
                return Unauthorized();

            if (!int.TryParse(uid, out var userId))
                return Unauthorized();

            var user = await _ctx.Users.FindAsync(userId);

            if (user == null)
                return Unauthorized();

            if (!user.IsActive)
                return Unauthorized();

            const int PASSWORD_EXP_DAYS = 90;

            var last = user.PasswordLastChangedAt ?? DateTime.UtcNow.AddDays(-PASSWORD_EXP_DAYS - 1);
            var expiresAt = last.AddDays(PASSWORD_EXP_DAYS);
            var daysLeft = (int)Math.Floor((expiresAt - DateTime.UtcNow).TotalDays);

            var expired = DateTime.UtcNow >= expiresAt;

            // Si está vencida, dejamos flag prendido (opcional pero consistente)
            if (expired && !user.MustChangePassword)
            {
                user.MustChangePassword = true;
                await _ctx.SaveChangesAsync();
            }

            user.Role = (user.Role ?? "VENTAS").ToUpperInvariant();
            var mePerms = await LoadPermissionsAsync(user.Role);

            return Ok(new
            {
                user.Id,
                user.Username,
                user.FullName,
                user.Email,
                role = user.Role,
                mustChangePassword = user.MustChangePassword || expired,
                passwordExpiresAt = expiresAt,
                passwordDaysLeft = daysLeft,
                permissions = mePerms
            });
        }

        // ---------------------------------------------------------
        // 🔵 VALIDAR TOKEN (opcional)
        // ---------------------------------------------------------
        [Authorize]
        [HttpGet("validate")]
        public IActionResult Validate()
        {
            return Ok(new { valid = true });
        }

        // ---------------------------------------------------------
        // 🔵 REFRESH (rota refresh token)
        // ---------------------------------------------------------
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            var refresh = Request.Cookies["refresh_token"];
            if (string.IsNullOrWhiteSpace(refresh))
                return Unauthorized();

            var users = await _ctx.Users
                .Where(u => u.RefreshTokenHash != null)
                .ToListAsync();

            var user = users.FirstOrDefault(u => PasswordHasher.Verify(refresh, u.RefreshTokenHash!));

            if (user == null) return Unauthorized();
            if (user.RefreshTokenExpiresAt == null || user.RefreshTokenExpiresAt < DateTime.UtcNow)
                return Unauthorized();

            if (!user.IsActive) return Unauthorized();

            user.Role = (user.Role ?? "VENTAS").ToUpperInvariant();

            var refreshPerms = await LoadPermissionsAsync(user.Role);
            var newAccess = _jwt.GenerateAccessToken(user, refreshPerms);
            var newRefresh = _jwt.GenerateRefreshToken();

            user.RefreshTokenHash = PasswordHasher.Hash(newRefresh);
            user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);

            await _ctx.SaveChangesAsync();

            SetAuthCookies(newAccess, newRefresh);

            return Ok(new { ok = true });
        }

        // ---------------------------------------------------------
        // 🔵 REGISTER
        // ---------------------------------------------------------
        [Authorize]
        [RequirePermission(Perms.UsersCreate)]
        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterRequest req)
        {
            if (req == null) return BadRequest("Request inválido.");

            var username = (req.Username ?? "").Trim();
            var email = (req.Email ?? "").Trim();
            var fullName = (req.FullName ?? "").Trim();
            var password = req.Password ?? "";
            var role = (req.Role ?? "").Trim();

            if (string.IsNullOrWhiteSpace(username))
                return BadRequest("Username es requerido.");

            if (string.IsNullOrWhiteSpace(email))
                return BadRequest("Email es requerido.");

            if (string.IsNullOrWhiteSpace(fullName))
                return BadRequest("FullName es requerido.");

            if (string.IsNullOrWhiteSpace(password))
                return BadRequest("Password es requerido.");

            // Normalizar role
            if (string.IsNullOrWhiteSpace(role))
                role = "VENTAS";
            role = role.ToUpperInvariant();

            // Solo ADMIN puede crear usuarios ADMIN
            var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            if (role == "ADMIN" && callerRole != "ADMIN")
                return Forbid();

            // Duplicados (case-insensitive)
            var usernameLower = username.ToLower();
            var emailLower = email.ToLower();

            var existsUser = await _ctx.Users.AnyAsync(u => u.Username.ToLower() == usernameLower);
            if (existsUser) return BadRequest("Ese usuario ya existe.");

            var existsEmail = await _ctx.Users.AnyAsync(u => u.Email.ToLower() == emailLower);
            if (existsEmail) return BadRequest("Ese email ya existe.");

            var (ok, error) = PasswordPolicy.Validate(password);
            if (!ok) return BadRequest(error);

            var user = new User
            {
                Username = username,
                Email = email,
                FullName = fullName,
                PasswordHash = PasswordHasher.Hash(password),
                Role = role,
                IsActive = true,
                PasswordLastChangedAt = DateTime.UtcNow,
                MustChangePassword = false,
            };

            _ctx.Users.Add(user);
            await _ctx.SaveChangesAsync();



            return Ok(new { message = "Usuario creado correctamente" });
        }

        // ---------------------------------------------------------
        // 🔵 LOGOUT
        // ---------------------------------------------------------
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var refresh = Request.Cookies["refresh_token"];

            if (!string.IsNullOrWhiteSpace(refresh))
            {
                var users = await _ctx.Users.Where(u => u.RefreshTokenHash != null).ToListAsync();
                var user = users.FirstOrDefault(u => PasswordHasher.Verify(refresh, u.RefreshTokenHash!));
                if (user != null)
                {
                    user.RefreshTokenHash = null;
                    user.RefreshTokenExpiresAt = null;
                    await _ctx.SaveChangesAsync();
                }
            }

            // IMPORTANTE: borrar con Path "/"
            Response.Cookies.Delete("access_token", new CookieOptions { Path = "/" });
            Response.Cookies.Delete("refresh_token", new CookieOptions { Path = "/" });

            return Ok(new { ok = true });
        }

        public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
        {
            var uid = User.FindFirst("uid")?.Value;
            if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();
            if (!int.TryParse(uid, out var userId)) return Unauthorized();

            var user = await _ctx.Users.FindAsync(userId);
            if (user == null) return Unauthorized();
            if (!user.IsActive) return Unauthorized();

            // Validar password actual
            if (!PasswordHasher.Verify(req.CurrentPassword ?? "", user.PasswordHash))
                return BadRequest("Contraseña actual incorrecta.");

            // Validar nueva password robusta
            var (ok, error) = PasswordPolicy.Validate(req.NewPassword ?? "");
            if (!ok) return BadRequest(error);

            // Evitar misma contraseña
            if (PasswordHasher.Verify(req.NewPassword, user.PasswordHash))
                return BadRequest("La nueva contraseña no puede ser igual a la actual.");

            user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
            user.PasswordLastChangedAt = DateTime.UtcNow;
            user.MustChangePassword = false;

            await _ctx.SaveChangesAsync();

            return Ok(new { ok = true });
        }

        // ---------------------------------------------------------
        // 🔒 HELPER: carga permisos del rol desde la DB
        // ---------------------------------------------------------
        private async Task<List<string>> LoadPermissionsAsync(string role)
        {
            if (role.ToUpperInvariant() == "ADMIN")
                return new List<string>(); // ADMIN no necesita perms en el token; el filter lo bypasea

            return await _ctx.RolePermissions
                .Where(rp => rp.RoleName == role)
                .Select(rp => rp.Permission.Code)
                .ToListAsync();
        }

        // ---------------------------------------------------------
        // 🔒 COOKIES
        // ---------------------------------------------------------
        private void SetAuthCookies(string accessToken, string refreshToken)
        {
            var isProd = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production";

            // En producción usamos SameSite=None para que SignalR pueda conectarse
            // directamente a Railway desde el frontend en Vercel (cross-site).
            // AllowCredentials() en CORS protege contra CSRF.
            var sameSite = isProd ? SameSiteMode.None : SameSiteMode.Lax;

            Response.Cookies.Append("access_token", accessToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = isProd,
                SameSite = sameSite,
                Expires = DateTimeOffset.UtcNow.AddMinutes(480),
                MaxAge = TimeSpan.FromMinutes(480),
                Path = "/"
            });

            Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = isProd,
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(7),
                MaxAge = TimeSpan.FromDays(7),
                Path = "/"
            });
        }


    }
}
