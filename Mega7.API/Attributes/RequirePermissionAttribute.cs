using Mega7.API.Filters;
using Microsoft.AspNetCore.Mvc;

namespace Mega7.API.Attributes
{
    /// <summary>
    /// Aplica un check de permiso en un action o controller completo.
    /// Uso: [RequirePermission(Perms.APInvoicesCreate)]
    /// </summary>
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
    public class RequirePermissionAttribute : TypeFilterAttribute
    {
        public RequirePermissionAttribute(string code) : base(typeof(PermissionFilter))
        {
            Arguments = new object[] { code };
        }
    }
}
