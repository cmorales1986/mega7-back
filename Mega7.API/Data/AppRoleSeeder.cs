using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data
{
    public static class AppRoleSeeder
    {
        public static async Task SeedAsync(Mega7DbContext db)
        {
            var systemRoles = new[]
            {
                new { Name = "ADMIN",      Description = "Administrador del sistema. Acceso total.",           IsSystem = true  },
                new { Name = "SUPERVISOR", Description = "Supervisor. Acceso amplio sin configuración.",       IsSystem = true  },
                new { Name = "CAJERO",     Description = "Cajero. Acceso a operaciones de caja y cobros.",    IsSystem = true  },
                new { Name = "VENTAS",     Description = "Vendedor. Acceso a ventas y consultas.",            IsSystem = true  },
            };

            foreach (var r in systemRoles)
            {
                if (!await db.AppRoles.AnyAsync(x => x.Name == r.Name))
                {
                    db.AppRoles.Add(new AppRole
                    {
                        Name        = r.Name,
                        Description = r.Description,
                        IsSystem    = r.IsSystem,
                        CreatedAt   = DateTime.UtcNow,
                    });
                }
            }

            await db.SaveChangesAsync();
        }
    }
}
