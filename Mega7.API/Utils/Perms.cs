namespace Mega7.API.Utils
{
    /// <summary>Códigos de permiso del sistema. Usar siempre estas constantes en los atributos.</summary>
    public static class Perms
    {
        // ── General ──────────────────────────────────────────────────────────
        public const string DashboardView = "Dashboard.View";

        // ── Períodos ─────────────────────────────────────────────────────────
        public const string PeriodsView       = "Periods.View";
        public const string PeriodsCreate     = "Periods.Create";
        public const string PeriodsClose      = "Periods.Close";
        public const string PeriodsOpen       = "Periods.Open";
        public const string PeriodsDeactivate = "Periods.Deactivate";

        // ── Socios de Negocio ─────────────────────────────────────────────────
        public const string SociosView   = "SociosNegocio.View";
        public const string SociosCreate = "SociosNegocio.Create";
        public const string SociosEdit   = "SociosNegocio.Edit";
        public const string SociosDelete = "SociosNegocio.Delete";

        // ── Productos ─────────────────────────────────────────────────────────
        public const string ProductsView   = "Products.View";
        public const string ProductsCreate = "Products.Create";
        public const string ProductsEdit   = "Products.Edit";
        public const string ProductsDelete = "Products.Delete";

        public const string CategoriesView   = "Categories.View";
        public const string CategoriesCreate = "Categories.Create";
        public const string CategoriesEdit   = "Categories.Edit";
        public const string CategoriesDelete = "Categories.Delete";

        public const string SubCategoriesView   = "SubCategories.View";
        public const string SubCategoriesCreate = "SubCategories.Create";
        public const string SubCategoriesEdit   = "SubCategories.Edit";
        public const string SubCategoriesDelete = "SubCategories.Delete";

        public const string BrandsView   = "Brands.View";
        public const string BrandsCreate = "Brands.Create";
        public const string BrandsEdit   = "Brands.Edit";
        public const string BrandsDelete = "Brands.Delete";

        public const string UnitsView   = "UnitsOfMeasure.View";
        public const string UnitsCreate = "UnitsOfMeasure.Create";
        public const string UnitsEdit   = "UnitsOfMeasure.Edit";
        public const string UnitsDelete = "UnitsOfMeasure.Delete";

        public const string TaxesView   = "Taxes.View";
        public const string TaxesCreate = "Taxes.Create";
        public const string TaxesEdit   = "Taxes.Edit";
        public const string TaxesDelete = "Taxes.Delete";

        // ── Inventario ────────────────────────────────────────────────────────
        public const string WarehousesView   = "Warehouses.View";
        public const string WarehousesCreate = "Warehouses.Create";
        public const string WarehousesEdit   = "Warehouses.Edit";
        public const string WarehousesDelete = "Warehouses.Delete";

        public const string StockView = "Stock.View";

        public const string StockEntryView    = "StockEntry.View";
        public const string StockEntryCreate  = "StockEntry.Create";
        public const string StockEntryConfirm = "StockEntry.Confirm";
        public const string StockEntryCancel  = "StockEntry.Cancel";

        public const string StockOutputView    = "StockOutput.View";
        public const string StockOutputCreate  = "StockOutput.Create";
        public const string StockOutputConfirm = "StockOutput.Confirm";
        public const string StockOutputCancel  = "StockOutput.Cancel";

        public const string StockTransferView    = "StockTransfer.View";
        public const string StockTransferCreate  = "StockTransfer.Create";
        public const string StockTransferConfirm = "StockTransfer.Confirm";
        public const string StockTransferCancel  = "StockTransfer.Cancel";

        public const string BatchesView   = "Batches.View";
        public const string BatchesCreate = "Batches.Create";
        public const string BatchesEdit   = "Batches.Edit";

        // ── Ventas ────────────────────────────────────────────────────────────
        public const string SalesOrdersView   = "SalesOrders.View";
        public const string SalesOrdersCreate = "SalesOrders.Create";
        public const string SalesOrdersEdit   = "SalesOrders.Edit";
        public const string SalesOrdersCancel = "SalesOrders.Cancel";

        public const string SalesInvoicesView   = "SalesInvoices.View";
        public const string SalesInvoicesCreate = "SalesInvoices.Create";
        public const string SalesInvoicesCancel = "SalesInvoices.Cancel";
        public const string SalesInvoicesPrint  = "SalesInvoices.Print";

        public const string ARInvoicesView                 = "ARInvoices.View";
        public const string ARInvoicesGenerateInstallments = "ARInvoices.GenerateInstallments";
        public const string ARInvoicesCancel               = "ARInvoices.Cancel";
        public const string ARInvoicesReopen               = "ARInvoices.Reopen";

        public const string ARPaymentsView   = "ARPayments.View";
        public const string ARPaymentsCreate = "ARPayments.Create";
        public const string ARPaymentsCancel = "ARPayments.Cancel";

        public const string ARReceiptsView   = "ARSalesReceipts.View";
        public const string ARReceiptsCreate = "ARSalesReceipts.Create";

        // ── Compras ───────────────────────────────────────────────────────────
        public const string PurchaseOrdersView   = "PurchaseOrders.View";
        public const string PurchaseOrdersCreate = "PurchaseOrders.Create";
        public const string PurchaseOrdersEdit   = "PurchaseOrders.Edit";
        public const string PurchaseOrdersCancel = "PurchaseOrders.Cancel";

        public const string PurchaseReceiptsView    = "PurchaseReceipts.View";
        public const string PurchaseReceiptsCreate  = "PurchaseReceipts.Create";
        public const string PurchaseReceiptsEdit    = "PurchaseReceipts.Edit";
        public const string PurchaseReceiptsConfirm = "PurchaseReceipts.Confirm";

        public const string APInvoicesView   = "APInvoices.View";
        public const string APInvoicesCreate = "APInvoices.Create";
        public const string APInvoicesCancel = "APInvoices.Cancel";

        public const string APPaymentsView   = "APPayments.View";
        public const string APPaymentsCreate = "APPayments.Create";
        public const string APPaymentsCancel = "APPayments.Cancel";

        // ── Finanzas ──────────────────────────────────────────────────────────
        public const string BanksView   = "Banks.View";
        public const string BanksCreate = "Banks.Create";
        public const string BanksEdit   = "Banks.Edit";

        public const string CashBoxesView   = "CashBoxes.View";
        public const string CashBoxesCreate = "CashBoxes.Create";
        public const string CashBoxesEdit   = "CashBoxes.Edit";

        public const string BankDepositsView   = "BankDeposits.View";
        public const string BankDepositsCreate = "BankDeposits.Create";

        public const string PaymentsMadeView     = "PaymentsMade.View";
        public const string PaymentsReceivedView = "PaymentsReceived.View";

        public const string PaymentConceptsView   = "PaymentConcepts.View";
        public const string PaymentConceptsCreate = "PaymentConcepts.Create";
        public const string PaymentConceptsEdit   = "PaymentConcepts.Edit";
        public const string PaymentConceptsDelete = "PaymentConcepts.Delete";

        // ── Reportes ──────────────────────────────────────────────────────────
        public const string ReportsView = "Reports.View";

        // ── Configuración ─────────────────────────────────────────────────────
        public const string FiscalSeriesView   = "FiscalDocumentSeries.View";
        public const string FiscalSeriesCreate = "FiscalDocumentSeries.Create";
        public const string FiscalSeriesEdit   = "FiscalDocumentSeries.Edit";

        public const string CreditTermsView   = "CreditTerms.View";
        public const string CreditTermsCreate = "CreditTerms.Create";
        public const string CreditTermsEdit   = "CreditTerms.Edit";
        public const string CreditTermsDelete = "CreditTerms.Delete";

        public const string SalesParamsView = "SalesParams.View";
        public const string SalesParamsEdit = "SalesParams.Edit";

        public const string ReportMenuView   = "ReportMenu.View";
        public const string ReportMenuCreate = "ReportMenu.Create";
        public const string ReportMenuEdit   = "ReportMenu.Edit";
        public const string ReportMenuDelete = "ReportMenu.Delete";

        public const string TenantsView = "Tenants.View";
        public const string TenantsEdit = "Tenants.Edit";

        public const string NotificationsView = "Notifications.View";

        // ── Contabilidad ─────────────────────────────────────────────────────
        public const string AccountingAccountsView   = "Accounting.AccountsView";
        public const string AccountingAccountsCreate = "Accounting.AccountsCreate";
        public const string AccountingAccountsEdit   = "Accounting.AccountsEdit";
        public const string AccountingJournalView    = "Accounting.JournalView";
        public const string AccountingJournalCreate  = "Accounting.JournalCreate";
        public const string AccountingReportsView    = "Accounting.ReportsView";
        public const string AccountingConfigView     = "Accounting.ConfigView";
        public const string AccountingConfigEdit     = "Accounting.ConfigEdit";

        // ── Administración ────────────────────────────────────────────────
        public const string UsersView       = "Users.View";
        public const string UsersCreate     = "Users.Create";
        public const string UsersEdit       = "Users.Edit";
        public const string UsersDeactivate = "Users.Deactivate";
    }
}
