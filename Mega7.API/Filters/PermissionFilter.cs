using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace Mega7.API.Filters
{
    /// <summary>
    /// Verifica que el usuario autenticado tenga el permiso requerido.
    /// ADMIN bypasea todos los checks automáticamente.
    /// </summary>
    public class PermissionFilter : IAuthorizationFilter
    {
        private readonly string _code;

        public PermissionFilter(string code) => _code = code;

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;

            if (!(user.Identity?.IsAuthenticated ?? false))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var role = user.FindFirst(ClaimTypes.Role)?.Value ?? "";
            if (role.ToUpperInvariant() == "ADMIN")
                return; // ADMIN tiene acceso total

            var perms = user.FindAll("perm")
                            .Select(c => c.Value)
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (!perms.Contains(_code))
            {
                context.Result = new JsonResult(new
                {
                    error = "No tiene permiso para realizar esta operación.",
                    requiredPermission = _code
                })
                { StatusCode = 403 };
            }
        }
    }
}
