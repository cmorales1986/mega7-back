using Mega7.API.Utils;
using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data
{
    public static class PermissionSeeder
    {
        private record PermDef(string Code, string DisplayName, string Group, int Sort);

        private static readonly PermDef[] AllPerms =
        [
            // ── General ──────────────────────────────────────────────────────
            new(Perms.DashboardView,               "Dashboard: Ver",                           "General",          1),

            // ── Períodos ─────────────────────────────────────────────────────
            new(Perms.PeriodsView,                 "Períodos: Ver",                             "Períodos",        10),
            new(Perms.PeriodsCreate,               "Períodos: Crear",                           "Períodos",        11),
            new(Perms.PeriodsClose,                "Períodos: Cerrar",                          "Períodos",        12),
            new(Perms.PeriodsOpen,                 "Períodos: Reabrir",                         "Períodos",        13),
            new(Perms.PeriodsDeactivate,           "Períodos: Desactivar",                      "Períodos",        14),

            // ── Socios de Negocio ─────────────────────────────────────────────
            new(Perms.SociosView,                  "Socios de Negocio: Ver",                    "Socios de Negocio", 20),
            new(Perms.SociosCreate,                "Socios de Negocio: Crear",                  "Socios de Negocio", 21),
            new(Perms.SociosEdit,                  "Socios de Negocio: Editar",                 "Socios de Negocio", 22),
            new(Perms.SociosDelete,                "Socios de Negocio: Eliminar",               "Socios de Negocio", 23),

            // ── Productos ─────────────────────────────────────────────────────
            new(Perms.ProductsView,                "Productos: Ver",                            "Productos",       30),
            new(Perms.ProductsCreate,              "Productos: Crear",                          "Productos",       31),
            new(Perms.ProductsEdit,                "Productos: Editar",                         "Productos",       32),
            new(Perms.ProductsDelete,              "Productos: Eliminar",                       "Productos",       33),
            new(Perms.CategoriesView,              "Categorías: Ver",                           "Productos",       34),
            new(Perms.CategoriesCreate,            "Categorías: Crear",                         "Productos",       35),
            new(Perms.CategoriesEdit,              "Categorías: Editar",                        "Productos",       36),
            new(Perms.CategoriesDelete,            "Categorías: Eliminar",                      "Productos",       37),
            new(Perms.SubCategoriesView,           "Subcategorías: Ver",                        "Productos",       38),
            new(Perms.SubCategoriesCreate,         "Subcategorías: Crear",                      "Productos",       39),
            new(Perms.SubCategoriesEdit,           "Subcategorías: Editar",                     "Productos",       40),
            new(Perms.SubCategoriesDelete,         "Subcategorías: Eliminar",                   "Productos",       41),
            new(Perms.BrandsView,                  "Marcas: Ver",                               "Productos",       42),
            new(Perms.BrandsCreate,                "Marcas: Crear",                             "Productos",       43),
            new(Perms.BrandsEdit,                  "Marcas: Editar",                            "Productos",       44),
            new(Perms.BrandsDelete,                "Marcas: Eliminar",                          "Productos",       45),
            new(Perms.UnitsView,                   "Unidades de Medida: Ver",                   "Productos",       46),
            new(Perms.UnitsCreate,                 "Unidades de Medida: Crear",                 "Productos",       47),
            new(Perms.UnitsEdit,                   "Unidades de Medida: Editar",                "Productos",       48),
            new(Perms.UnitsDelete,                 "Unidades de Medida: Eliminar",              "Productos",       49),
            new(Perms.TaxesView,                   "Impuestos: Ver",                            "Productos",       50),
            new(Perms.TaxesCreate,                 "Impuestos: Crear",                          "Productos",       51),
            new(Perms.TaxesEdit,                   "Impuestos: Editar",                         "Productos",       52),
            new(Perms.TaxesDelete,                 "Impuestos: Eliminar",                       "Productos",       53),

            // ── Inventario ────────────────────────────────────────────────────
            new(Perms.WarehousesView,              "Almacenes: Ver",                            "Inventario",      60),
            new(Perms.WarehousesCreate,            "Almacenes: Crear",                          "Inventario",      61),
            new(Perms.WarehousesEdit,              "Almacenes: Editar",                         "Inventario",      62),
            new(Perms.WarehousesDelete,            "Almacenes: Eliminar",                       "Inventario",      63),
            new(Perms.StockView,                   "Stock: Ver",                                "Inventario",      64),
            new(Perms.StockEntryView,              "Entrada de Stock: Ver",                     "Inventario",      65),
            new(Perms.StockEntryCreate,            "Entrada de Stock: Crear",                   "Inventario",      66),
            new(Perms.StockEntryConfirm,           "Entrada de Stock: Confirmar",               "Inventario",      67),
            new(Perms.StockEntryCancel,            "Entrada de Stock: Anular",                  "Inventario",      68),
            new(Perms.StockOutputView,             "Salida de Stock: Ver",                      "Inventario",      69),
            new(Perms.StockOutputCreate,           "Salida de Stock: Crear",                    "Inventario",      70),
            new(Perms.StockOutputConfirm,          "Salida de Stock: Confirmar",                "Inventario",      71),
            new(Perms.StockOutputCancel,           "Salida de Stock: Anular",                   "Inventario",      72),
            new(Perms.StockTransferView,           "Transferencia de Stock: Ver",               "Inventario",      73),
            new(Perms.StockTransferCreate,         "Transferencia de Stock: Crear",             "Inventario",      74),
            new(Perms.StockTransferConfirm,        "Transferencia de Stock: Confirmar",         "Inventario",      75),
            new(Perms.StockTransferCancel,         "Transferencia de Stock: Anular",            "Inventario",      76),
            new(Perms.BatchesView,                 "Lotes: Ver",                                "Inventario",      77),
            new(Perms.BatchesCreate,               "Lotes: Crear",                              "Inventario",      78),
            new(Perms.BatchesEdit,                 "Lotes: Editar",                             "Inventario",      79),

            // ── Ventas ────────────────────────────────────────────────────────
            new(Perms.SalesOrdersView,             "Pedidos de Venta: Ver",                     "Ventas",          80),
            new(Perms.SalesOrdersCreate,           "Pedidos de Venta: Crear",                   "Ventas",          81),
            new(Perms.SalesOrdersEdit,             "Pedidos de Venta: Editar",                  "Ventas",          82),
            new(Perms.SalesOrdersCancel,           "Pedidos de Venta: Cancelar",                "Ventas",          83),
            new(Perms.SalesInvoicesView,           "Facturas de Venta: Ver",                    "Ventas",          84),
            new(Perms.SalesInvoicesCreate,         "Facturas de Venta: Crear",                  "Ventas",          85),
            new(Perms.SalesInvoicesCancel,         "Facturas de Venta: Anular",                 "Ventas",          86),
            new(Perms.SalesInvoicesPrint,          "Facturas de Venta: Imprimir PDF",           "Ventas",          87),
            new(Perms.ARInvoicesView,              "CxC: Ver",                                  "Ventas",          88),
            new(Perms.ARInvoicesGenerateInstallments, "CxC: Generar Cuotas",                   "Ventas",          89),
            new(Perms.ARInvoicesCancel,            "CxC: Anular",                               "Ventas",          90),
            new(Perms.ARInvoicesReopen,            "CxC: Reabrir",                              "Ventas",          91),
            new(Perms.ARPaymentsView,              "Cobros (CxC): Ver",                         "Ventas",          92),
            new(Perms.ARPaymentsCreate,            "Cobros (CxC): Registrar",                   "Ventas",          93),
            new(Perms.ARPaymentsCancel,            "Cobros (CxC): Anular",                      "Ventas",          94),
            new(Perms.ARReceiptsView,              "Recibos de Cobro: Ver",                     "Ventas",          95),
            new(Perms.ARReceiptsCreate,            "Recibos de Cobro: Crear",                   "Ventas",          96),

            // ── Compras ───────────────────────────────────────────────────────
            new(Perms.PurchaseOrdersView,          "Órdenes de Compra: Ver",                    "Compras",         100),
            new(Perms.PurchaseOrdersCreate,        "Órdenes de Compra: Crear",                  "Compras",         101),
            new(Perms.PurchaseOrdersEdit,          "Órdenes de Compra: Editar",                 "Compras",         102),
            new(Perms.PurchaseOrdersCancel,        "Órdenes de Compra: Cancelar",               "Compras",         103),
            new(Perms.PurchaseReceiptsView,        "Recepciones de Compra: Ver",                "Compras",         104),
            new(Perms.PurchaseReceiptsCreate,      "Recepciones de Compra: Crear",              "Compras",         105),
            new(Perms.PurchaseReceiptsEdit,        "Recepciones de Compra: Editar",             "Compras",         106),
            new(Perms.PurchaseReceiptsConfirm,     "Recepciones de Compra: Confirmar",          "Compras",         107),
            new(Perms.APInvoicesView,              "Facturas de Compra: Ver",                   "Compras",         108),
            new(Perms.APInvoicesCreate,            "Facturas de Compra: Crear",                 "Compras",         109),
            new(Perms.APInvoicesCancel,            "Facturas de Compra: Anular",                "Compras",         110),
            new(Perms.APPaymentsView,              "Pagos a Proveedores: Ver",                  "Compras",         111),
            new(Perms.APPaymentsCreate,            "Pagos a Proveedores: Registrar",            "Compras",         112),
            new(Perms.APPaymentsCancel,            "Pagos a Proveedores: Anular",               "Compras",         113),

            // ── Finanzas ──────────────────────────────────────────────────────
            new(Perms.BanksView,                   "Bancos: Ver",                               "Finanzas",        120),
            new(Perms.BanksCreate,                 "Bancos: Crear",                             "Finanzas",        121),
            new(Perms.BanksEdit,                   "Bancos: Editar",                            "Finanzas",        122),
            new(Perms.CashBoxesView,               "Cajas: Ver",                                "Finanzas",        123),
            new(Perms.CashBoxesCreate,             "Cajas: Crear",                              "Finanzas",        124),
            new(Perms.CashBoxesEdit,               "Cajas: Editar",                             "Finanzas",        125),
            new(Perms.BankDepositsView,            "Depósitos Bancarios: Ver",                  "Finanzas",        126),
            new(Perms.BankDepositsCreate,          "Depósitos Bancarios: Crear",                "Finanzas",        127),
            new(Perms.PaymentsMadeView,            "Pagos Realizados: Ver",                     "Finanzas",        128),
            new(Perms.PaymentsReceivedView,        "Pagos Recibidos: Ver",                      "Finanzas",        129),
            new(Perms.PaymentConceptsView,         "Conceptos de Pago: Ver",                    "Finanzas",        130),
            new(Perms.PaymentConceptsCreate,       "Conceptos de Pago: Crear",                  "Finanzas",        131),
            new(Perms.PaymentConceptsEdit,         "Conceptos de Pago: Editar",                 "Finanzas",        132),
            new(Perms.PaymentConceptsDelete,       "Conceptos de Pago: Eliminar",               "Finanzas",        133),

            // ── Contabilidad ──────────────────────────────────────────────────
            new(Perms.AccountingAccountsView,   "Plan de Cuentas: Ver",         "Contabilidad", 180),
            new(Perms.AccountingAccountsCreate, "Plan de Cuentas: Crear",       "Contabilidad", 181),
            new(Perms.AccountingAccountsEdit,   "Plan de Cuentas: Editar",      "Contabilidad", 182),
            new(Perms.AccountingJournalView,    "Libro Diario: Ver",            "Contabilidad", 183),
            new(Perms.AccountingJournalCreate,  "Libro Diario: Crear asiento",  "Contabilidad", 184),
            new(Perms.AccountingReportsView,    "Reportes Contables: Ver",      "Contabilidad", 185),
            new(Perms.AccountingConfigView,     "Config. Contable: Ver",        "Contabilidad", 186),
            new(Perms.AccountingConfigEdit,     "Config. Contable: Editar",     "Contabilidad", 187),

            // ── Reportes ──────────────────────────────────────────────────────
            new(Perms.ReportsView,                 "Reportes: Ver",                             "Reportes",        140),

            // ── Configuración ─────────────────────────────────────────────────
            new(Perms.FiscalSeriesView,            "Series Fiscales: Ver",                      "Configuración",   150),
            new(Perms.FiscalSeriesCreate,          "Series Fiscales: Crear",                    "Configuración",   151),
            new(Perms.FiscalSeriesEdit,            "Series Fiscales: Editar",                   "Configuración",   152),
            new(Perms.CreditTermsView,             "Condiciones de Crédito: Ver",               "Configuración",   153),
            new(Perms.CreditTermsCreate,           "Condiciones de Crédito: Crear",             "Configuración",   154),
            new(Perms.CreditTermsEdit,             "Condiciones de Crédito: Editar",            "Configuración",   155),
            new(Perms.CreditTermsDelete,           "Condiciones de Crédito: Eliminar",          "Configuración",   156),
            new(Perms.SalesParamsView,             "Parámetros de Venta: Ver",                  "Configuración",   157),
            new(Perms.SalesParamsEdit,             "Parámetros de Venta: Editar",               "Configuración",   158),
            new(Perms.ReportMenuView,              "Menú de Reportes: Ver",                     "Configuración",   159),
            new(Perms.ReportMenuCreate,            "Menú de Reportes: Crear",                   "Configuración",   160),
            new(Perms.ReportMenuEdit,              "Menú de Reportes: Editar",                  "Configuración",   161),
            new(Perms.ReportMenuDelete,            "Menú de Reportes: Eliminar",                "Configuración",   162),
            new(Perms.TenantsView,                 "Empresas: Ver",                             "Configuración",   163),
            new(Perms.TenantsEdit,                 "Empresas: Editar",                          "Configuración",   164),
            new(Perms.NotificationsView,           "Notificaciones: Ver",                       "Configuración",   165),

            // ── Administración ────────────────────────────────────────────────
            new(Perms.UsersView,                   "Usuarios: Ver",                             "Administración",  170),
            new(Perms.UsersCreate,                 "Usuarios: Crear",                           "Administración",  171),
            new(Perms.UsersEdit,                   "Usuarios: Editar",                          "Administración",  172),
            new(Perms.UsersDeactivate,             "Usuarios: Desactivar",                      "Administración",  173),
        ];

        // Permisos por defecto del rol USER (operador estándar).
        private static readonly HashSet<string> DefaultUserPerms =
        [
            // ── Ver todo ──────────────────────────────────────────────────────
            Perms.DashboardView,
            Perms.PeriodsView,
            Perms.SociosView,
            Perms.ProductsView, Perms.CategoriesView, Perms.SubCategoriesView,
            Perms.BrandsView, Perms.UnitsView, Perms.TaxesView,
            Perms.WarehousesView, Perms.StockView,
            Perms.StockEntryView, Perms.StockOutputView, Perms.StockTransferView, Perms.BatchesView,
            Perms.SalesOrdersView, Perms.SalesInvoicesView, Perms.ARInvoicesView,
            Perms.ARPaymentsView, Perms.ARReceiptsView,
            Perms.PurchaseOrdersView, Perms.PurchaseReceiptsView,
            Perms.APInvoicesView, Perms.APPaymentsView,
            Perms.BanksView, Perms.CashBoxesView, Perms.BankDepositsView,
            Perms.PaymentsMadeView, Perms.PaymentsReceivedView, Perms.PaymentConceptsView,
            Perms.ReportsView,
            Perms.AccountingAccountsView, Perms.AccountingJournalView,
            Perms.AccountingReportsView, Perms.AccountingConfigView,
            Perms.FiscalSeriesView, Perms.CreditTermsView,
            Perms.SalesParamsView, Perms.ReportMenuView,
            Perms.TenantsView, Perms.NotificationsView,

            // ── Crear / Editar operaciones del día a día ──────────────────────
            Perms.SociosCreate, Perms.SociosEdit,
            Perms.ProductsCreate, Perms.ProductsEdit,
            Perms.CategoriesCreate, Perms.CategoriesEdit,
            Perms.SubCategoriesCreate, Perms.SubCategoriesEdit,
            Perms.BrandsCreate, Perms.BrandsEdit,
            Perms.UnitsCreate, Perms.UnitsEdit,
            Perms.SalesOrdersCreate, Perms.SalesOrdersEdit,
            Perms.SalesInvoicesCreate, Perms.SalesInvoicesPrint,
            Perms.ARInvoicesGenerateInstallments,
            Perms.ARPaymentsCreate,
            Perms.ARReceiptsCreate,
            Perms.PurchaseOrdersCreate, Perms.PurchaseOrdersEdit,
            Perms.PurchaseReceiptsCreate, Perms.PurchaseReceiptsEdit, Perms.PurchaseReceiptsConfirm,
            Perms.APInvoicesCreate,
            Perms.APPaymentsCreate,
            Perms.StockEntryCreate, Perms.StockEntryConfirm,
            Perms.StockOutputCreate, Perms.StockOutputConfirm,
            Perms.StockTransferCreate, Perms.StockTransferConfirm,
            Perms.BatchesCreate, Perms.BatchesEdit,
            Perms.BankDepositsCreate,
        ];

        public static async Task SeedAsync(Mega7DbContext ctx)
        {
            // 1) Crear o actualizar definiciones de permisos
            var existingCodes = (await ctx.Permissions
                .Select(p => p.Code)
                .ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var def in AllPerms)
            {
                if (!existingCodes.Contains(def.Code))
                {
                    var parts = def.Code.Split('.');
                    ctx.Permissions.Add(new Mega7.SHARED.Entities.Permission
                    {
                        Code        = def.Code,
                        Module      = parts[0],
                        Action      = parts.Length > 1 ? parts[1] : "",
                        DisplayName = def.DisplayName,
                        Group       = def.Group,
                        SortOrder   = def.Sort,
                    });
                }
            }
            await ctx.SaveChangesAsync();

            // 2) Seed default USER role — solo si no tiene NINGÚN permiso aún
            var userHasAny = await ctx.RolePermissions
                .AnyAsync(rp => rp.RoleName == "USER");

            if (!userHasAny)
            {
                var permMap = await ctx.Permissions
                    .ToDictionaryAsync(p => p.Code, p => p.Id);

                foreach (var code in DefaultUserPerms)
                {
                    if (permMap.TryGetValue(code, out var permId))
                    {
                        ctx.RolePermissions.Add(new Mega7.SHARED.Entities.RolePermission
                        {
                            RoleName     = "USER",
                            PermissionId = permId,
                        });
                    }
                }
                await ctx.SaveChangesAsync();
            }
        }
    }
}
