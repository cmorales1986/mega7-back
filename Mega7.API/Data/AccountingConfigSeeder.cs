using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data
{
    public static class AccountingConfigSeeder
    {
        private static readonly (string Key, string Label, string Group)[] Defaults =
        [
            // ── Ventas ────────────────────────────────────────────────────────
            ("VENTAS_GRAVADAS",    "Ingresos por Ventas Gravadas",       "Ventas"),
            ("VENTAS_EXENTAS",     "Ingresos por Ventas Exentas",        "Ventas"),
            ("DESCUENTOS_VENTAS",  "Descuentos sobre Ventas",            "Ventas"),
            ("COSTO_VENTAS",       "Costo de Mercaderías Vendidas",      "Ventas"),

            // ── Compras ───────────────────────────────────────────────────────
            ("DESCUENTOS_COMPRAS", "Descuentos sobre Compras",           "Compras"),

            // ── Cuentas por Cobrar / Pagar ────────────────────────────────────
            ("AR_CLIENTES",        "Clientes (Cuentas por Cobrar)",      "Créditos"),
            ("AP_PROVEEDORES",     "Proveedores (Cuentas por Pagar)",    "Créditos"),

            // ── Tesorería / Genéricos ─────────────────────────────────────────
            ("DIFERENCIA_CAMBIO",  "Diferencia de Cambio",               "Tesorería"),
            ("GASTOS_BANCARIOS",   "Gastos Bancarios",                   "Tesorería"),
            ("INTERESES_PAGADOS",  "Intereses Pagados",                  "Tesorería"),
            ("INTERESES_GANADOS",  "Intereses Ganados",                  "Tesorería"),

            // ── Cierre ────────────────────────────────────────────────────────
            ("RESULTADO_EJERCICIO","Resultado del Ejercicio",            "Cierre"),
        ];

        public static async Task SeedAsync(Mega7DbContext db)
        {
            foreach (var (key, label, group) in Defaults)
            {
                if (!await db.AccountingConfigs.AnyAsync(c => c.Key == key))
                {
                    db.AccountingConfigs.Add(new AccountingConfig
                    {
                        Key = key, Label = label, Group = group
                    });
                }
            }
            await db.SaveChangesAsync();
        }
    }
}
