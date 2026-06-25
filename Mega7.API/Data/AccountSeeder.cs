using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data
{
    public static class AccountSeeder
    {
        public static async Task SeedAsync(Mega7DbContext db)
        {
            if (await db.Accounts.AnyAsync()) return;

            // ── Helpers ────────────────────────────────────────────────────────
            Account T(string code, string name, AccountType type, AccountNature nature, int level, int? parentId = null) =>
                new() { Code = code, Name = name, Type = type, Nature = nature, Level = level, IsTitle = true,  IsActive = true, ParentId = parentId };

            Account M(string code, string name, AccountType type, AccountNature nature, int level, int? parentId = null) =>
                new() { Code = code, Name = name, Type = type, Nature = nature, Level = level, IsTitle = false, IsActive = true, ParentId = parentId };

            // ── NIVEL 1 — Grupos principales ──────────────────────────────────
            var a1   = T("1",   "ACTIVO",         AccountType.Activo,     AccountNature.Deudora,    1);
            var a2   = T("2",   "PASIVO",          AccountType.Pasivo,     AccountNature.Acreedora,  1);
            var a3   = T("3",   "PATRIMONIO NETO", AccountType.Patrimonio, AccountNature.Acreedora,  1);
            var a4   = T("4",   "INGRESOS",        AccountType.Ingresos,   AccountNature.Acreedora,  1);
            var a5   = T("5",   "COSTOS",          AccountType.Costos,     AccountNature.Deudora,    1);
            var a6   = T("6",   "GASTOS",          AccountType.Gastos,     AccountNature.Deudora,    1);

            db.Accounts.AddRange(a1, a2, a3, a4, a5, a6);
            await db.SaveChangesAsync();

            // ── NIVEL 2 — Activo ──────────────────────────────────────────────
            var a101 = T("1.01", "ACTIVO CORRIENTE",     AccountType.Activo, AccountNature.Deudora, 2, a1.Id);
            var a102 = T("1.02", "ACTIVO NO CORRIENTE",  AccountType.Activo, AccountNature.Deudora, 2, a1.Id);
            db.Accounts.AddRange(a101, a102);

            // ── NIVEL 2 — Pasivo ──────────────────────────────────────────────
            var a201 = T("2.01", "PASIVO CORRIENTE",     AccountType.Pasivo, AccountNature.Acreedora, 2, a2.Id);
            var a202 = T("2.02", "PASIVO NO CORRIENTE",  AccountType.Pasivo, AccountNature.Acreedora, 2, a2.Id);
            db.Accounts.AddRange(a201, a202);

            // ── NIVEL 2 — Patrimonio ──────────────────────────────────────────
            var a301 = T("3.01", "CAPITAL",              AccountType.Patrimonio, AccountNature.Acreedora, 2, a3.Id);
            var a302 = T("3.02", "RESULTADOS ACUMULADOS",AccountType.Patrimonio, AccountNature.Acreedora, 2, a3.Id);
            db.Accounts.AddRange(a301, a302);

            // ── NIVEL 2 — Ingresos ────────────────────────────────────────────
            var a401 = T("4.01", "INGRESOS OPERATIVOS",  AccountType.Ingresos, AccountNature.Acreedora, 2, a4.Id);
            var a402 = T("4.02", "INGRESOS NO OPERATIVOS",AccountType.Ingresos,AccountNature.Acreedora, 2, a4.Id);
            db.Accounts.AddRange(a401, a402);

            // ── NIVEL 2 — Costos ──────────────────────────────────────────────
            var a501 = T("5.01", "COSTO DE VENTAS",      AccountType.Costos, AccountNature.Deudora, 2, a5.Id);
            db.Accounts.AddRange(a501);

            // ── NIVEL 2 — Gastos ──────────────────────────────────────────────
            var a601 = T("6.01", "GASTOS OPERATIVOS",    AccountType.Gastos, AccountNature.Deudora, 2, a6.Id);
            var a602 = T("6.02", "GASTOS FINANCIEROS",   AccountType.Gastos, AccountNature.Deudora, 2, a6.Id);
            var a603 = T("6.03", "GASTOS ADMINISTRATIVOS",AccountType.Gastos,AccountNature.Deudora, 2, a6.Id);
            db.Accounts.AddRange(a601, a602, a603);

            await db.SaveChangesAsync();

            // ── NIVEL 3 — Activo Corriente ────────────────────────────────────
            var a10101 = T("1.01.01", "DISPONIBILIDADES",        AccountType.Activo, AccountNature.Deudora, 3, a101.Id);
            var a10102 = T("1.01.02", "CUENTAS POR COBRAR",      AccountType.Activo, AccountNature.Deudora, 3, a101.Id);
            var a10103 = T("1.01.03", "INVENTARIOS",             AccountType.Activo, AccountNature.Deudora, 3, a101.Id);
            var a10104 = T("1.01.04", "OTROS ACTIVOS CORRIENTES",AccountType.Activo, AccountNature.Deudora, 3, a101.Id);
            db.Accounts.AddRange(a10101, a10102, a10103, a10104);

            // ── NIVEL 3 — Activo No Corriente ─────────────────────────────────
            var a10201 = T("1.02.01", "INMUEBLES Y EQUIPOS",     AccountType.Activo, AccountNature.Deudora, 3, a102.Id);
            var a10202 = T("1.02.02", "DEPRECIACIÓN ACUMULADA",  AccountType.Activo, AccountNature.Deudora, 3, a102.Id);
            var a10203 = T("1.02.03", "INTANGIBLES",             AccountType.Activo, AccountNature.Deudora, 3, a102.Id);
            db.Accounts.AddRange(a10201, a10202, a10203);

            // ── NIVEL 3 — Pasivo Corriente ────────────────────────────────────
            var a20101 = T("2.01.01", "PROVEEDORES",             AccountType.Pasivo, AccountNature.Acreedora, 3, a201.Id);
            var a20102 = T("2.01.02", "IMPUESTOS POR PAGAR",     AccountType.Pasivo, AccountNature.Acreedora, 3, a201.Id);
            var a20103 = T("2.01.03", "PRÉSTAMOS CORTO PLAZO",   AccountType.Pasivo, AccountNature.Acreedora, 3, a201.Id);
            var a20104 = T("2.01.04", "OTRAS CUENTAS POR PAGAR", AccountType.Pasivo, AccountNature.Acreedora, 3, a201.Id);
            db.Accounts.AddRange(a20101, a20102, a20103, a20104);

            // ── NIVEL 3 — Pasivo No Corriente ─────────────────────────────────
            var a20201 = T("2.02.01", "PRÉSTAMOS LARGO PLAZO",   AccountType.Pasivo, AccountNature.Acreedora, 3, a202.Id);
            db.Accounts.AddRange(a20201);

            // ── NIVEL 3 — Ingresos Operativos ─────────────────────────────────
            var a40101 = T("4.01.01", "VENTAS",                  AccountType.Ingresos, AccountNature.Acreedora, 3, a401.Id);
            var a40102 = T("4.01.02", "DESCUENTOS SOBRE VENTAS", AccountType.Ingresos, AccountNature.Deudora,   3, a401.Id);
            db.Accounts.AddRange(a40101, a40102);

            // ── NIVEL 3 — Ingresos No Operativos ─────────────────────────────
            var a40201 = T("4.02.01", "INTERESES GANADOS",       AccountType.Ingresos, AccountNature.Acreedora, 3, a402.Id);
            var a40202 = T("4.02.02", "OTROS INGRESOS",          AccountType.Ingresos, AccountNature.Acreedora, 3, a402.Id);
            db.Accounts.AddRange(a40201, a40202);

            await db.SaveChangesAsync();

            // ── NIVEL 4 — Cuentas de movimiento: Disponibilidades ────────────
            db.Accounts.AddRange(
                M("1.01.01.001", "Caja Principal",              AccountType.Activo, AccountNature.Deudora, 4, a10101.Id),
                M("1.01.01.002", "Caja Chica",                  AccountType.Activo, AccountNature.Deudora, 4, a10101.Id),
                M("1.01.01.003", "Banco - Cuenta Corriente",    AccountType.Activo, AccountNature.Deudora, 4, a10101.Id),
                M("1.01.01.004", "Banco - Cuenta de Ahorro",    AccountType.Activo, AccountNature.Deudora, 4, a10101.Id)
            );

            // ── NIVEL 4 — Cuentas por cobrar ─────────────────────────────────
            db.Accounts.AddRange(
                M("1.01.02.001", "Clientes",                    AccountType.Activo, AccountNature.Deudora, 4, a10102.Id),
                M("1.01.02.002", "Documentos por Cobrar",       AccountType.Activo, AccountNature.Deudora, 4, a10102.Id),
                M("1.01.02.003", "IVA Crédito Fiscal",          AccountType.Activo, AccountNature.Deudora, 4, a10102.Id)
            );

            // ── NIVEL 4 — Inventarios ─────────────────────────────────────────
            db.Accounts.AddRange(
                M("1.01.03.001", "Mercaderías",                 AccountType.Activo, AccountNature.Deudora, 4, a10103.Id),
                M("1.01.03.002", "Materias Primas",             AccountType.Activo, AccountNature.Deudora, 4, a10103.Id)
            );

            // ── NIVEL 4 — Proveedores ─────────────────────────────────────────
            db.Accounts.AddRange(
                M("2.01.01.001", "Proveedores Locales",         AccountType.Pasivo, AccountNature.Acreedora, 4, a20101.Id),
                M("2.01.01.002", "Proveedores del Exterior",    AccountType.Pasivo, AccountNature.Acreedora, 4, a20101.Id),
                M("2.01.01.003", "Documentos por Pagar",        AccountType.Pasivo, AccountNature.Acreedora, 4, a20101.Id)
            );

            // ── NIVEL 4 — Impuestos por pagar ────────────────────────────────
            db.Accounts.AddRange(
                M("2.01.02.001", "IVA Débito Fiscal",           AccountType.Pasivo, AccountNature.Acreedora, 4, a20102.Id),
                M("2.01.02.002", "Retenciones por Pagar",       AccountType.Pasivo, AccountNature.Acreedora, 4, a20102.Id),
                M("2.01.02.003", "Impuesto a la Renta por Pagar",AccountType.Pasivo,AccountNature.Acreedora, 4, a20102.Id)
            );

            // ── NIVEL 4 — Capital ─────────────────────────────────────────────
            db.Accounts.AddRange(
                M("3.01.001", "Capital Social",                 AccountType.Patrimonio, AccountNature.Acreedora, 3, a301.Id),
                M("3.02.001", "Resultado del Ejercicio",        AccountType.Patrimonio, AccountNature.Acreedora, 3, a302.Id),
                M("3.02.002", "Resultados Anteriores",          AccountType.Patrimonio, AccountNature.Acreedora, 3, a302.Id)
            );

            // ── NIVEL 4 — Ventas / Costo ──────────────────────────────────────
            db.Accounts.AddRange(
                M("4.01.01.001", "Ventas Gravadas",             AccountType.Ingresos, AccountNature.Acreedora, 4, a40101.Id),
                M("4.01.01.002", "Ventas Exentas",              AccountType.Ingresos, AccountNature.Acreedora, 4, a40101.Id),
                M("5.01.001",    "Costo de Mercaderías Vendidas",AccountType.Costos,  AccountNature.Deudora,   3, a501.Id)
            );

            // ── NIVEL 4 — Gastos ──────────────────────────────────────────────
            db.Accounts.AddRange(
                M("6.01.001", "Sueldos y Jornales",             AccountType.Gastos, AccountNature.Deudora, 3, a601.Id),
                M("6.01.002", "Cargas Sociales",                AccountType.Gastos, AccountNature.Deudora, 3, a601.Id),
                M("6.01.003", "Alquileres",                     AccountType.Gastos, AccountNature.Deudora, 3, a601.Id),
                M("6.01.004", "Energía y Servicios",            AccountType.Gastos, AccountNature.Deudora, 3, a601.Id),
                M("6.02.001", "Intereses Pagados",              AccountType.Gastos, AccountNature.Deudora, 3, a602.Id),
                M("6.02.002", "Gastos Bancarios",               AccountType.Gastos, AccountNature.Deudora, 3, a602.Id),
                M("6.03.001", "Gastos de Oficina",              AccountType.Gastos, AccountNature.Deudora, 3, a603.Id),
                M("6.03.002", "Depreciaciones",                 AccountType.Gastos, AccountNature.Deudora, 3, a603.Id),
                M("6.03.003", "Publicidad y Marketing",         AccountType.Gastos, AccountNature.Deudora, 3, a603.Id)
            );

            await db.SaveChangesAsync();
        }
    }
}
