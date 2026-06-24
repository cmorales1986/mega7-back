using Mega7.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Filters
{
    public class PasswordExpiryFilter : IAsyncActionFilter
    {
        private const int PASSWORD_EXP_DAYS = 90;

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var path = context.HttpContext.Request.Path.Value?.ToLower() ?? "";

            // Allowlist de endpoints permitidos aunque esté vencido
            if (path.Contains("/api/auth/me") ||
                path.Contains("/api/auth/change-password") ||
                path.Contains("/api/auth/logout") ||
                path.Contains("/api/auth/refresh") ||
                path.Contains("/api/auth/validate") ||
                path.Contains("/api/auth/login") ||
                path.Contains("/api/auth/register"))
            {
                await next();
                return;
            }

            var userIdClaim = context.HttpContext.User.FindFirst("uid")?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            {
                await next();
                return;
            }

            var db = context.HttpContext.RequestServices.GetRequiredService<Mega7DbContext>();
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                await next();
                return;
            }

            var last = user.PasswordLastChangedAt ?? DateTime.UtcNow.AddDays(-PASSWORD_EXP_DAYS - 1);
            var expiresAt = last.AddDays(PASSWORD_EXP_DAYS);
            var expired = DateTime.UtcNow >= expiresAt;

            if (user.MustChangePassword || expired)
            {
                context.Result = new ObjectResult(new
                {
                    error = "PASSWORD_EXPIRED",
                    message = "Debe cambiar su contraseña para continuar."
                })
                { StatusCode = 403 };

                return;
            }

            await next();
        }
    }
}
