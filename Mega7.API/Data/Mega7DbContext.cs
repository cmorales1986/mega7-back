using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Data
{
    public class Mega7DbContext : DbContext
    {
        public Mega7DbContext(DbContextOptions<Mega7DbContext> options)
           : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<SubCategory> SubCategories => Set<SubCategory>();
        public DbSet<UnitOfMeasure> UnitsOfMeasure => Set<UnitOfMeasure>();
        //public DbSet<StockEntry> StockEntries => Set<StockEntry>();
        public DbSet<Warehouse> Warehouses => Set<Warehouse>();
        public DbSet<Batch> Batches => Set<Batch>();
        public DbSet<Serial> Serials => Set<Serial>();
        public DbSet<Stock> Stocks => Set<Stock>();

        public DbSet<Brand> Brands => Set<Brand>();

        public DbSet<Tax> Taxes => Set<Tax>();  

        public DbSet<Product> Products => Set<Product>();

        public DbSet<StockEntry> StockEntries => Set<StockEntry>();
        public DbSet<StockEntryLine> StockEntryLines => Set<StockEntryLine>();

        public DbSet<SocioNegocio> SociosNegocio => Set<SocioNegocio>();
        public DbSet<SocioNegocioSucursal> SocioNegocioSucursales => Set<SocioNegocioSucursal>();

        public DbSet<StockOutput> StockOutputs => Set<StockOutput>();
        public DbSet<StockOutputLine> StockOutputLines => Set<StockOutputLine>();

        public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
        public DbSet<StockTransferLine> StockTransferLines => Set<StockTransferLine>();

        public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
        public DbSet<PurchaseOrderLine> PurchaseOrderLines => Set<PurchaseOrderLine>();

        public DbSet<PurchaseReceipt> PurchaseReceipts => Set<PurchaseReceipt>();
        public DbSet<PurchaseReceiptLine> PurchaseReceiptLines => Set<PurchaseReceiptLine>();
        public DbSet<PurchaseReceiptDocument> PurchaseReceiptDocuments { get; set; }

        public DbSet<APInvoice> APInvoices => Set<APInvoice>();

        public DbSet<APInvoicePayment> APInvoicePayments { get; set; }

        public DbSet<CreditTerm> CreditTerms => Set<CreditTerm>();

        public DbSet<APInvoiceInstallment> APInvoiceInstallments => Set<APInvoiceInstallment>();

        public DbSet<Period> Periods => Set<Period>();

        public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
        public DbSet<SalesOrderLine> SalesOrderLines => Set<SalesOrderLine>();

        public DbSet<ARInvoice> ARInvoices => Set<ARInvoice>();
        public DbSet<ARInvoiceLine> ARInvoiceLines => Set<ARInvoiceLine>();
        public DbSet<ARInvoiceInstallment> ARInvoiceInstallments => Set<ARInvoiceInstallment>();
        public DbSet<ARInvoicePayment> ARInvoicePayments => Set<ARInvoicePayment>();

        public DbSet<SalesPricingParams> SalesPricingParams => Set<SalesPricingParams>();
        public DbSet<CreditMarkupRule> CreditMarkupRules => Set<CreditMarkupRule>();
        public DbSet<InstallmentMarkupRule> InstallmentMarkupRules => Set<InstallmentMarkupRule>();
        public DbSet<LateFeeRule> LateFeeRules => Set<LateFeeRule>();

        public DbSet<CreditTermMarkup> CreditTermMarkups => Set<CreditTermMarkup>();

        public DbSet<Bank> Banks => Set<Bank>();
        public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
        public DbSet<BankMovement> BankMovements => Set<BankMovement>();

        public DbSet<CashBox> CashBoxes => Set<CashBox>();
        public DbSet<CashCategory> CashCategories => Set<CashCategory>();
        public DbSet<CashMovement> CashMovements => Set<CashMovement>();
        public DbSet<CashSession> CashSessions => Set<CashSession>();

        public DbSet<UserNotificationState> UserNotificationStates => Set<UserNotificationState>();

        public DbSet<FiscalDocumentSeries> FiscalDocumentSeries => Set<FiscalDocumentSeries>();

        public DbSet<ARSalesReceipt> ARSalesReceipts => Set<ARSalesReceipt>();
        public DbSet<ARSalesReceiptLine> ARSalesReceiptLines => Set<ARSalesReceiptLine>();

        public DbSet<PaymentMade> PaymentsMade => Set<PaymentMade>();
        public DbSet<PaymentMadeApply> PaymentMadeApplies => Set<PaymentMadeApply>();

        public DbSet<PaymentConcept> PaymentConcepts => Set<PaymentConcept>();

        public DbSet<APInvoiceLine> APInvoiceLines => Set<APInvoiceLine>();

        public DbSet<ReportMenu> ReportMenus => Set<ReportMenu>();

        public DbSet<Tenant> Tenants => Set<Tenant>();

        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

        public DbSet<AppRole> AppRoles => Set<AppRole>();

        public DbSet<Message> Messages => Set<Message>();

        public DbSet<Account> Accounts => Set<Account>();
        public DbSet<AccountingConfig> AccountingConfigs => Set<AccountingConfig>();

        public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
        public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();

        // ── RRHH ──────────────────────────────────────────────────────────────
        public DbSet<Employee> Employees => Set<Employee>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<AppRole>()
                .HasIndex(r => r.Name)
                .IsUnique();

            // Plan de cuentas — árbol auto-referenciado
            modelBuilder.Entity<Account>()
                .HasIndex(a => a.Code)
                .IsUnique();

            modelBuilder.Entity<Account>()
                .HasOne(a => a.Parent)
                .WithMany(a => a.Children)
                .HasForeignKey(a => a.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Account>()
                .Property(a => a.Type)
                .HasConversion<string>();

            modelBuilder.Entity<Account>()
                .Property(a => a.Nature)
                .HasConversion<string>();

            // AccountingConfig — índice único en Key
            modelBuilder.Entity<AccountingConfig>()
                .HasIndex(c => c.Key).IsUnique();

            modelBuilder.Entity<AccountingConfig>()
                .HasOne(c => c.Account).WithMany()
                .HasForeignKey(c => c.AccountId)
                .OnDelete(DeleteBehavior.SetNull);

            // Category → cuentas contables (todas opcionales)
            modelBuilder.Entity<Category>()
                .HasOne(c => c.RevenueAccount).WithMany()
                .HasForeignKey(c => c.RevenueAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Category>()
                .HasOne(c => c.CogsAccount).WithMany()
                .HasForeignKey(c => c.CogsAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Category>()
                .HasOne(c => c.InventoryAccount).WithMany()
                .HasForeignKey(c => c.InventoryAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Category>()
                .HasOne(c => c.PurchaseAccount).WithMany()
                .HasForeignKey(c => c.PurchaseAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            // CashBox → Account (opcional)
            modelBuilder.Entity<CashBox>()
                .HasOne(c => c.Account).WithMany()
                .HasForeignKey(c => c.AccountId)
                .OnDelete(DeleteBehavior.SetNull);

            // BankAccount → Account (opcional)
            modelBuilder.Entity<BankAccount>()
                .HasOne(b => b.Account).WithMany()
                .HasForeignKey(b => b.AccountId)
                .OnDelete(DeleteBehavior.SetNull);

            // Tax → Account ventas/compras (opcional)
            modelBuilder.Entity<Tax>()
                .HasOne(t => t.SalesAccount).WithMany()
                .HasForeignKey(t => t.SalesAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Tax>()
                .HasOne(t => t.PurchaseAccount).WithMany()
                .HasForeignKey(t => t.PurchaseAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            // Libro diario
            modelBuilder.Entity<JournalEntry>()
                .Property(j => j.SourceType)
                .HasConversion<string>();

            modelBuilder.Entity<JournalEntry>()
                .Property(j => j.Status)
                .HasConversion<string>();

            modelBuilder.Entity<JournalEntryLine>()
                .HasOne(l => l.JournalEntry)
                .WithMany(j => j.Lines)
                .HasForeignKey(l => l.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<JournalEntryLine>()
                .HasOne(l => l.Account)
                .WithMany()
                .HasForeignKey(l => l.AccountId)
                .OnDelete(DeleteBehavior.Restrict);

            // 👉 StockEntryLine → Warehouse (NO CASCADE)
            modelBuilder.Entity<StockEntryLine>()
                .HasOne(l => l.Warehouse)
                .WithMany()
                .HasForeignKey(l => l.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // 👉 StockEntryLine → Product (NO CASCADE)
            modelBuilder.Entity<StockEntryLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // 👉 StockEntryLine → StockEntry (ESTE SÍ CASCADE)
            modelBuilder.Entity<StockEntryLine>()
                .HasOne(l => l.StockEntry)
                .WithMany(e => e.Lines)
                .HasForeignKey(l => l.StockEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            // 👉 StockEntry → Warehouse (NO CASCADE)
            modelBuilder.Entity<StockEntry>()
                .HasOne(e => e.Warehouse)
                .WithMany()
                .HasForeignKey(e => e.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // PRODUCT → BRAND  (no cascade)
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Brand)
                .WithMany()
                .HasForeignKey(p => p.BrandId)
                .OnDelete(DeleteBehavior.Restrict);

            // PRODUCT → CATEGORY  (no cascade)
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Category)
                .WithMany()
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            // PRODUCT → SUBCATEGORY  (no cascade)
            modelBuilder.Entity<Product>()
                .HasOne(p => p.SubCategory)
                .WithMany()
                .HasForeignKey(p => p.SubCategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            // PRODUCT → UNIT OF MEASURE  (no cascade)
            modelBuilder.Entity<Product>()
                .HasOne(p => p.UnitOfMeasure)
                .WithMany()
                .HasForeignKey(p => p.UnitOfMeasureId)
                .OnDelete(DeleteBehavior.Restrict);

            // PRODUCT → TAX  (no cascade)
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Tax)
                .WithMany()
                .HasForeignKey(p => p.TaxId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockOutputLine>()
                .HasOne(l => l.Warehouse)
                .WithMany()
                .HasForeignKey(l => l.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockOutputLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockOutputLine>()
                .HasOne(l => l.StockOutput)
                .WithMany(o => o.Lines)
                .HasForeignKey(l => l.StockOutputId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<StockOutput>()
                .HasOne(o => o.Warehouse)
                .WithMany()
                .HasForeignKey(o => o.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockTransferLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockTransferLine>()
                .HasOne(l => l.StockTransfer)
                .WithMany(t => t.Lines)
                .HasForeignKey(l => l.StockTransferId)
                .OnDelete(DeleteBehavior.Cascade);

            // STOCK TRANSFER → FromWarehouse (NO CASCADE)
            modelBuilder.Entity<StockTransfer>()
                .HasOne(t => t.FromWarehouse)
                .WithMany()
                .HasForeignKey(t => t.FromWarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // STOCK TRANSFER → ToWarehouse (NO CASCADE)
            modelBuilder.Entity<StockTransfer>()
                .HasOne(t => t.ToWarehouse)
                .WithMany()
                .HasForeignKey(t => t.ToWarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // STOCK TRANSFER LINE → Product (NO CASCADE)
            modelBuilder.Entity<StockTransferLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // STOCK TRANSFER LINE → StockTransfer (CASCADE OK)
            modelBuilder.Entity<StockTransferLine>()
                .HasOne(l => l.StockTransfer)
                .WithMany(t => t.Lines)
                .HasForeignKey(l => l.StockTransferId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PurchaseOrderLine>()
    .HasOne(l => l.Product)
    .WithMany()
    .HasForeignKey(l => l.ProductId)
    .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PurchaseOrderLine>()
                .HasOne(l => l.Tax)
                .WithMany()
                .HasForeignKey(l => l.TaxId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PurchaseOrderLine>()
                .HasOne(l => l.PurchaseOrder)
                .WithMany(o => o.Lines)
                .HasForeignKey(l => l.PurchaseOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PurchaseOrder>()
                .HasOne(o => o.Supplier)
                .WithMany()
                .HasForeignKey(o => o.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PurchaseOrder>()
                .HasOne(o => o.Warehouse)
                .WithMany()
                .HasForeignKey(o => o.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // PURCHASE RECEIPT LINE -> Product (NO CASCADE)
            modelBuilder.Entity<PurchaseReceiptLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // PURCHASE RECEIPT LINE -> Tax (NO CASCADE)
            modelBuilder.Entity<PurchaseReceiptLine>()
                .HasOne(l => l.Tax)
                .WithMany()
                .HasForeignKey(l => l.TaxId)
                .OnDelete(DeleteBehavior.Restrict);

            // PURCHASE RECEIPT LINE -> PurchaseReceipt (CASCADE)
            modelBuilder.Entity<PurchaseReceiptLine>()
                .HasOne(l => l.PurchaseReceipt)
                .WithMany(r => r.Lines)
                .HasForeignKey(l => l.PurchaseReceiptId)
                .OnDelete(DeleteBehavior.Cascade);

            // PURCHASE RECEIPT -> Supplier (NO CASCADE)
            modelBuilder.Entity<PurchaseReceipt>()
                .HasOne(r => r.Supplier)
                .WithMany()
                .HasForeignKey(r => r.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);

            // PURCHASE RECEIPT -> Warehouse (NO CASCADE)
            modelBuilder.Entity<PurchaseReceipt>()
                .HasOne(r => r.Warehouse)
                .WithMany()
                .HasForeignKey(r => r.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // PURCHASE RECEIPT -> PurchaseOrder (NO CASCADE)
            modelBuilder.Entity<PurchaseReceipt>()
                .HasOne(r => r.PurchaseOrder)
                .WithMany()
                .HasForeignKey(r => r.PurchaseOrderId)
                .OnDelete(DeleteBehavior.Restrict);

            // PURCHASE RECEIPT LINE -> PurchaseOrderLine (NO CASCADE)
            modelBuilder.Entity<PurchaseReceiptLine>()
                .HasOne(l => l.PurchaseOrderLine)
                .WithMany()
                .HasForeignKey(l => l.PurchaseOrderLineId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PurchaseReceiptDocument>()
                .HasIndex(x => new { x.PurchaseReceiptId, x.Type, x.Number })
                .IsUnique();

            modelBuilder.Entity<APInvoice>()
                .HasIndex(x => x.PurchaseReceiptId)
                .IsUnique();

            modelBuilder.Entity<APInvoice>()
                .HasOne(x => x.PurchaseReceipt)
                .WithOne(r => r.APInvoice)
                .HasForeignKey<APInvoice>(x => x.PurchaseReceiptId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<APInvoicePayment>()
                .HasOne(p => p.APInvoice)
                .WithMany(a => a.Payments) // si no agregaste Payments, cambiá a .WithMany()
                .HasForeignKey(p => p.APInvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SocioNegocio>()
                .HasOne(s => s.CreditTerm)
                .WithMany()
                .HasForeignKey(s => s.CreditTermId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<APInvoiceInstallment>()
                .HasOne(x => x.APInvoice)
                .WithMany(x => x.Installments)
                .HasForeignKey(x => x.APInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<APInvoiceInstallment>()
                .HasIndex(x => new { x.APInvoiceId, x.InstallmentNo })
                .IsUnique();

            modelBuilder.Entity<Period>()
                .HasIndex(p => new { p.Year, p.Month })
                .IsUnique();

            modelBuilder.Entity<SalesOrderLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SalesOrderLine>()
                .HasOne(l => l.SalesOrder)
                .WithMany(o => o.Lines)
                .HasForeignKey(l => l.SalesOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SalesOrder>()
                .HasOne(o => o.Customer)
                .WithMany()
                .HasForeignKey(o => o.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SalesOrder>()
                .HasOne(o => o.Warehouse)
                .WithMany()
                .HasForeignKey(o => o.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // ARInvoiceLine → Product (NO CASCADE)
            modelBuilder.Entity<ARInvoiceLine>()
                .HasOne(l => l.Product)
                .WithMany()
                .HasForeignKey(l => l.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // ARInvoiceLine → Tax (NO CASCADE)
            modelBuilder.Entity<ARInvoiceLine>()
                .HasOne(l => l.Tax)
                .WithMany()
                .HasForeignKey(l => l.TaxId)
                .OnDelete(DeleteBehavior.Restrict);

            // ARInvoiceLine → ARInvoice (CASCADE)
            modelBuilder.Entity<ARInvoiceLine>()
                .HasOne(l => l.ARInvoice)
                .WithMany(i => i.Lines)
                .HasForeignKey(l => l.ARInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            // ARInvoice → Customer (NO CASCADE)
            modelBuilder.Entity<ARInvoice>()
                .HasOne(i => i.Customer)
                .WithMany()
                .HasForeignKey(i => i.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            // ARInvoice → Warehouse (NO CASCADE)
            modelBuilder.Entity<ARInvoice>()
                .HasOne(i => i.Warehouse)
                .WithMany()
                .HasForeignKey(i => i.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            // Installments → ARInvoice (CASCADE)
            modelBuilder.Entity<ARInvoiceInstallment>()
                .HasOne(x => x.ARInvoice)
                .WithMany(i => i.Installments)
                .HasForeignKey(x => x.ARInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Payments → ARInvoice (CASCADE)
            modelBuilder.Entity<ARInvoicePayment>()
                .HasOne(x => x.ARInvoice)
                .WithMany(i => i.Payments)
                .HasForeignKey(x => x.ARInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SalesPricingParams>()
    .HasOne(x => x.Customer)
    .WithMany()
    .HasForeignKey(x => x.CustomerId)
    .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CreditMarkupRule>()
                .HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<InstallmentMarkupRule>()
                .HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<LateFeeRule>()
                .HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Índices recomendados
            modelBuilder.Entity<SalesPricingParams>()
                .HasIndex(x => x.CustomerId);

            modelBuilder.Entity<CreditMarkupRule>()
                .HasIndex(x => new { x.CustomerId, x.MinDays, x.MaxDays });

            modelBuilder.Entity<InstallmentMarkupRule>()
                .HasIndex(x => new { x.CustomerId, x.MinInstallments, x.MaxInstallments, x.IntervalDays });

            modelBuilder.Entity<LateFeeRule>()
                .HasIndex(x => new { x.CustomerId, x.MinDaysLate, x.MaxDaysLate });

            modelBuilder.Entity<CreditTermMarkup>()
                .HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CreditTermMarkup>()
                .HasOne(x => x.CreditTerm)
                .WithMany()
                .HasForeignKey(x => x.CreditTermId)
                .OnDelete(DeleteBehavior.Restrict);

            // Un registro por (CustomerId, CreditTermId)
            // OJO: CustomerId es nullable, igual funciona bien como “global” (CustomerId null).
            modelBuilder.Entity<CreditTermMarkup>()
                .HasIndex(x => new { x.CustomerId, x.CreditTermId })
                .IsUnique();


            // BANK -> ACCOUNTS (CASCADE OK)
            modelBuilder.Entity<Mega7.SHARED.Entities.BankAccount>()
                .HasOne(a => a.Bank)
                .WithMany(b => b.Accounts)
                .HasForeignKey(a => a.BankId)
                .OnDelete(DeleteBehavior.Cascade);

            // MOVEMENT -> Account (para IN/OUT) (NO CASCADE)
            modelBuilder.Entity<Mega7.SHARED.Entities.BankMovement>()
                .HasOne(m => m.Account)
                .WithMany()
                .HasForeignKey(m => m.AccountId)
                .OnDelete(DeleteBehavior.Restrict);

            // MOVEMENT -> FromAccount (NO CASCADE)
            modelBuilder.Entity<Mega7.SHARED.Entities.BankMovement>()
                .HasOne(m => m.FromAccount)
                .WithMany()
                .HasForeignKey(m => m.FromAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            // MOVEMENT -> ToAccount (NO CASCADE)
            modelBuilder.Entity<Mega7.SHARED.Entities.BankMovement>()
                .HasOne(m => m.ToAccount)
                .WithMany()
                .HasForeignKey(m => m.ToAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CashSession>()
               .HasIndex(x => new { x.CashBoxId, x.Date })
               .IsUnique();

            modelBuilder.Entity<CashMovement>()
                .Property(x => x.Currency)
                .HasDefaultValue("PYG");

            // ✅ CashMovement -> CashBox (IN/OUT)
            modelBuilder.Entity<CashMovement>()
                .HasOne(m => m.CashBox)
                .WithMany(b => b.Movements)
                .HasForeignKey(m => m.CashBoxId)
                .OnDelete(DeleteBehavior.Restrict);

            // ✅ CashMovement -> CashBox (TRANSFER From)
            modelBuilder.Entity<CashMovement>()
                .HasOne(m => m.FromCashBox)
                .WithMany(b => b.TransfersOut)
                .HasForeignKey(m => m.FromCashBoxId)
                .OnDelete(DeleteBehavior.Restrict);

            // ✅ CashMovement -> CashBox (TRANSFER To)
            modelBuilder.Entity<CashMovement>()
                .HasOne(m => m.ToCashBox)
                .WithMany(b => b.TransfersIn)
                .HasForeignKey(m => m.ToCashBoxId)
                .OnDelete(DeleteBehavior.Restrict);

            // ✅ Category optional
            modelBuilder.Entity<CashMovement>()
                .HasOne(m => m.Category)
                .WithMany()
                .HasForeignKey(m => m.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FiscalDocumentSeries>()
            .HasIndex(x => new { x.DocumentType, x.Establishment, x.ExpeditionPoint, x.SeriesName })
            .IsUnique();

            // RECIBO LINE → RECIBO (CASCADE)
            modelBuilder.Entity<ARSalesReceiptLine>()
                .HasOne(l => l.ARSalesReceipt)
                .WithMany(r => r.Lines)
                .HasForeignKey(l => l.ARSalesReceiptId)
                .OnDelete(DeleteBehavior.Cascade);

            // RECIBO LINE → ARINVOICE (NO CASCADE)
            modelBuilder.Entity<ARSalesReceiptLine>()
                .HasOne(l => l.ARInvoice)
                .WithMany()
                .HasForeignKey(l => l.ARInvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            // PAYMENT → RECIBO (NO CASCADE)
            modelBuilder.Entity<ARInvoicePayment>()
                .HasOne(p => p.ARSalesReceipt)
                .WithMany(r => r.Payments)
                .HasForeignKey(p => p.ARSalesReceiptId)
                .OnDelete(DeleteBehavior.Restrict);

            // PaymentMade -> Applies (CASCADE)
            modelBuilder.Entity<PaymentMadeApply>()
                .HasOne(x => x.PaymentMade)
                .WithMany(x => x.Applies)
                .HasForeignKey(x => x.PaymentMadeId)
                .OnDelete(DeleteBehavior.Cascade);

            // PaymentMadeApply -> APInvoice (NO CASCADE)
            modelBuilder.Entity<PaymentMadeApply>()
                .HasOne(x => x.APInvoice)
                .WithMany()
                .HasForeignKey(x => x.APInvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PaymentConcept>()
                .HasIndex(x => x.Code)
                .IsUnique();

            modelBuilder.Entity<PaymentConcept>()
                .HasIndex(x => x.Name);

            // ── Permissions ──────────────────────────────────────────────────
            modelBuilder.Entity<Permission>()
                .HasIndex(p => p.Code)
                .IsUnique();

            modelBuilder.Entity<RolePermission>()
                .HasIndex(rp => new { rp.RoleName, rp.PermissionId })
                .IsUnique();

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PaymentMade>()
    .HasOne(x => x.PaymentConcept)
    .WithMany()
    .HasForeignKey(x => x.PaymentConceptId)
    .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<APInvoiceLine>()
            .HasOne(x => x.APInvoice)
            .WithMany() // si luego agregás navegación APInvoice.Lines, cambiamos a .WithMany(x=>x.Lines)
            .HasForeignKey(x => x.APInvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

            // Precision costos
            modelBuilder.Entity<Stock>()
                .Property(x => x.AvgCost)
                .HasColumnType("decimal(18,6)");

            modelBuilder.Entity<Batch>()
                .Property(x => x.UnitCost)
                .HasColumnType("decimal(18,6)");

            modelBuilder.Entity<Serial>()
                .Property(x => x.UnitCost)
                .HasColumnType("decimal(18,6)");

            modelBuilder.Entity<StockOutputLine>()
                .Property(x => x.UnitCostApplied)
                .HasColumnType("decimal(18,6)");

            modelBuilder.Entity<StockOutputLine>()
                .Property(x => x.LineCost)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<StockTransferLine>()
                .Property(x => x.UnitCostMoved)
                .HasColumnType("decimal(18,6)");

            modelBuilder.Entity<StockTransferLine>()
                .Property(x => x.LineCost)
                .HasColumnType("decimal(18,2)");

            // Índices únicos (evita duplicados silenciosos)
            modelBuilder.Entity<Stock>()
                .HasIndex(x => new { x.ProductId, x.WarehouseId })
                .IsUnique();

            modelBuilder.Entity<Batch>()
                .HasIndex(x => new { x.ProductId, x.WarehouseId, x.BatchNumber })
                .IsUnique();

            modelBuilder.Entity<Serial>()
                .HasIndex(x => new { x.ProductId, x.WarehouseId, x.SerialNumber })
                .IsUnique();






        }
    }
}
