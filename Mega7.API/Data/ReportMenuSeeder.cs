using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data;

public static class ReportMenuSeeder
{
    public static async Task SeedAsync(Mega7DbContext db)
    {
        if (await db.ReportMenus.AnyAsync()) return;

        // ── Grupos (Titulo = true) ─────────────────────────────────────────
        var grVentas      = new ReportMenu { Nombre = "Ventas",       Titulo = true, Orden = 1,  IsActive = true };
        var grOperaciones = new ReportMenu { Nombre = "Operaciones",  Titulo = true, Orden = 2,  IsActive = true };
        var grCxC         = new ReportMenu { Nombre = "CxC — Cobros", Titulo = true, Orden = 3,  IsActive = true };
        var grInventario  = new ReportMenu { Nombre = "Inventario",   Titulo = true, Orden = 4,  IsActive = true };

        db.ReportMenus.AddRange(grVentas, grOperaciones, grCxC, grInventario);
        await db.SaveChangesAsync();   // necesitamos los IDs para IdPadre

        // ── Items ─────────────────────────────────────────────────────────
        var items = new[]
        {
            new ReportMenu { Nombre = "Dashboard Ejecutivo",  Url = "/reports/dashboard",                    Icono = "LayoutGrid",   IdPadre = grVentas.Id,      Orden = 10, IsActive = true },
            new ReportMenu { Nombre = "Ventas vs Cobros",     Url = "/reports/ventas/ventas-vs-cobros",       Icono = "BarChart3",     IdPadre = grVentas.Id,      Orden = 20, IsActive = true },
            new ReportMenu { Nombre = "Resumen del Día",      Url = "/reports/operaciones/resumen-dia",       Icono = "CalendarCheck", IdPadre = grOperaciones.Id, Orden = 30, IsActive = true },
            new ReportMenu { Nombre = "Aging CxC",            Url = "/reports/cxc/aging",                    Icono = "HandCoins",     IdPadre = grCxC.Id,         Orden = 40, IsActive = true },
            new ReportMenu { Nombre = "Stock Actual",         Url = "/reports/inventario/stock-actual",      Icono = "Package",       IdPadre = grInventario.Id,  Orden = 50, IsActive = true },
        };

        db.ReportMenus.AddRange(items);
        await db.SaveChangesAsync();
    }
}
