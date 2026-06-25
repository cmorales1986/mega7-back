using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data;

public static class ReportMenuSeeder
{
    public static async Task SeedAsync(Mega7DbContext db)
    {
        // ── Seed inicial (solo si la tabla está vacía) ─────────────────────
        if (!await db.ReportMenus.AnyAsync())
        {
            var grVentas      = new ReportMenu { Nombre = "Ventas",       Titulo = true, Orden = 1, IsActive = true };
            var grOperaciones = new ReportMenu { Nombre = "Operaciones",  Titulo = true, Orden = 2, IsActive = true };
            var grCxC         = new ReportMenu { Nombre = "CxC — Cobros", Titulo = true, Orden = 3, IsActive = true };
            var grInventario  = new ReportMenu { Nombre = "Inventario",   Titulo = true, Orden = 4, IsActive = true };

            db.ReportMenus.AddRange(grVentas, grOperaciones, grCxC, grInventario);
            await db.SaveChangesAsync();

            db.ReportMenus.AddRange(
                new ReportMenu { Nombre = "Dashboard Ejecutivo", Url = "/reports/dashboard",                   Icono = "LayoutGrid",   IdPadre = grVentas.Id,      Orden = 10, IsActive = true },
                new ReportMenu { Nombre = "Ventas vs Cobros",    Url = "/reports/ventas/ventas-vs-cobros",      Icono = "BarChart3",     IdPadre = grVentas.Id,      Orden = 20, IsActive = true },
                new ReportMenu { Nombre = "Resumen del Día",     Url = "/reports/operaciones/resumen-dia",      Icono = "CalendarCheck", IdPadre = grOperaciones.Id, Orden = 30, IsActive = true },
                new ReportMenu { Nombre = "Aging CxC",           Url = "/reports/cxc/aging",                   Icono = "HandCoins",     IdPadre = grCxC.Id,         Orden = 40, IsActive = true },
                new ReportMenu { Nombre = "Stock Actual",        Url = "/reports/inventario/stock-actual",     Icono = "Package",       IdPadre = grInventario.Id,  Orden = 50, IsActive = true }
            );
            await db.SaveChangesAsync();
        }

        // ── Grupo Contabilidad (idempotente) ───────────────────────────────
        if (!await db.ReportMenus.AnyAsync(m => m.Titulo && m.Nombre == "Contabilidad"))
        {
            var grContabilidad = new ReportMenu { Nombre = "Contabilidad", Titulo = true, Orden = 5, IsActive = true };
            db.ReportMenus.Add(grContabilidad);
            await db.SaveChangesAsync();

            db.ReportMenus.AddRange(
                new ReportMenu { Nombre = "Bal. Comprobación", Url = "/accounting/reports/trial-balance",    Icono = "Scale",      IdPadre = grContabilidad.Id, Orden = 51, IsActive = true },
                new ReportMenu { Nombre = "Libro Mayor",       Url = "/accounting/reports/ledger",           Icono = "BookText",   IdPadre = grContabilidad.Id, Orden = 52, IsActive = true },
                new ReportMenu { Nombre = "Est. Resultados",   Url = "/accounting/reports/income-statement", Icono = "TrendingUp", IdPadre = grContabilidad.Id, Orden = 53, IsActive = true },
                new ReportMenu { Nombre = "Balance General",   Url = "/accounting/reports/balance-sheet",   Icono = "Layers",     IdPadre = grContabilidad.Id, Orden = 54, IsActive = true }
            );
            await db.SaveChangesAsync();
        }
    }
}
