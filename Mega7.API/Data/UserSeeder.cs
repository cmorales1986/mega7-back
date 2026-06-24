using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;
using Mega7.API.Utils;

namespace Mega7.API.Data
{
    public static class UserSeeder
    {
        public static async Task SeedAsync(Mega7DbContext ctx)
        {
            // Si ya existen usuarios, no hacemos nada
            if (await ctx.Users.AnyAsync())
                return;

            // Crear admin
            var admin = new User
            {
                Username = "admin",
                FullName = "Administrador del Sistema",
                PasswordHash = PasswordHasher.Hash("admin123"),
                Role = "ADMIN",
                Email = "christtian.morales@gmail.com",
                IsActive = true
            };

            ctx.Users.Add(admin);
            await ctx.SaveChangesAsync();
        }
    }
}
