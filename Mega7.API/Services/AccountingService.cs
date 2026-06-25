using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Services;

/// <summary>
/// Generates automatic journal entries when business documents are confirmed.
/// All methods are idempotent (safe to call twice). If required accounts are not
/// yet configured, the method returns silently without throwing.
/// </summary>
public class AccountingService
{
    private readonly Mega7DbContext _ctx;

    public AccountingService(Mega7DbContext ctx) => _ctx = ctx;

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<int?> Cfg(string key)
    {
        var c = await _ctx.AccountingConfigs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Key == key);
        return c?.AccountId;
    }

    private static void Accumulate(Dictionary<int, decimal> dict, int accountId, decimal amount)
    {
        if (amount <= 0) return;
        dict.TryGetValue(accountId, out var existing);
        dict[accountId] = existing + amount;
    }

    private JournalEntry BuildEntry(
        DateTime date, string description, string? reference,
        JournalEntrySource sourceType, int sourceId,
        List<JournalEntryLine> lines)
    {
        return new JournalEntry
        {
            Date = date,
            Description = description,
            Reference = reference,
            SourceType = sourceType,
            SourceId = sourceId,
            Status = JournalEntryStatus.Contabilizado,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "system",
            Lines = lines
        };
    }

    // ── 1. Sales Invoice ──────────────────────────────────────────────────────
    // DEBE  AR_CLIENTES                      = invoice.Total
    // HABER Ventas (per category / fallback) = line.LineSubTotal  (grouped by account)
    // HABER IVA Débito Fiscal               = line.LineTax        (grouped by tax account)
    public async Task PostARInvoiceAsync(int id)
    {
        if (await _ctx.JournalEntries.AnyAsync(j =>
                j.SourceType == JournalEntrySource.Venta && j.SourceId == id))
            return;

        var ar = await _ctx.ARInvoices
            .AsNoTracking()
            .Include(a => a.Lines!)
                .ThenInclude(l => l.Product!)
                    .ThenInclude(p => p.Category)
            .Include(a => a.Lines!)
                .ThenInclude(l => l.Tax)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (ar == null) return;

        var arAccountId = await Cfg("AR_CLIENTES");
        if (arAccountId == null) return;

        var revenueMap = new Dictionary<int, decimal>();
        var taxMap     = new Dictionary<int, decimal>();

        foreach (var line in ar.Lines ?? [])
        {
            // Revenue account: category-level override, then global fallback by taxability
            int? revId = line.Product?.Category?.RevenueAccountId;
            if (revId == null)
            {
                var key = line.LineTax > 0 ? "VENTAS_GRAVADAS" : "VENTAS_EXENTAS";
                revId = await Cfg(key);
            }

            if (revId != null && line.LineSubTotal > 0)
                Accumulate(revenueMap, revId.Value, line.LineSubTotal);

            // Tax account from the tax record
            if (line.LineTax > 0 && line.Tax?.SalesAccountId != null)
                Accumulate(taxMap, line.Tax.SalesAccountId.Value, line.LineTax);
        }

        // Build lines list
        var lines = new List<JournalEntryLine>
        {
            new() { AccountId = arAccountId.Value, Debit = ar.Total, Credit = 0,
                    Description = $"FC {ar.DocNumber}" }
        };

        foreach (var (accId, amt) in revenueMap)
            lines.Add(new() { AccountId = accId, Debit = 0, Credit = amt,
                              Description = "Ventas" });

        foreach (var (accId, amt) in taxMap)
            lines.Add(new() { AccountId = accId, Debit = 0, Credit = amt,
                              Description = "IVA Débito Fiscal" });

        if (!IsBalanced(lines)) return;

        _ctx.JournalEntries.Add(BuildEntry(
            ar.InvoiceDate.Date,
            $"Factura de Venta {ar.DocNumber}",
            ar.FiscalFullNumber ?? ar.DocNumber,
            JournalEntrySource.Venta, id, lines));

        await _ctx.SaveChangesAsync();
    }

    // ── 2. Purchase Invoice ───────────────────────────────────────────────────
    // DEBE  Inventario/Compras/Gastos (global key by SourceType) = ap.Total
    // HABER AP_PROVEEDORES                                        = ap.Total
    // Note: APInvoice stores only Total (no SubTotal/TaxTotal split),
    //       so we post the full amount without IVA separation.
    public async Task PostAPInvoiceAsync(int id)
    {
        if (await _ctx.JournalEntries.AnyAsync(j =>
                j.SourceType == JournalEntrySource.Compra && j.SourceId == id))
            return;

        var ap = await _ctx.APInvoices.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (ap == null) return;

        var apAccountId = await Cfg("AP_PROVEEDORES");
        if (apAccountId == null) return;

        var configKey = ap.SourceType.ToUpperInvariant() == "GOODS"
            ? "INVENTARIO_MERCANCIAS"
            : "COMPRAS_SERVICIOS";

        var debitAccountId = await Cfg(configKey)
                          ?? await Cfg("GASTOS_GENERALES");

        if (debitAccountId == null) return;

        var lines = new List<JournalEntryLine>
        {
            new() { AccountId = debitAccountId.Value, Debit = ap.Total, Credit = 0,
                    Description = $"FC Proveedor {ap.InvoiceNumber}" },
            new() { AccountId = apAccountId.Value,   Debit = 0, Credit = ap.Total,
                    Description = $"FC Proveedor {ap.InvoiceNumber}" }
        };

        if (!IsBalanced(lines)) return;

        _ctx.JournalEntries.Add(BuildEntry(
            ap.InvoiceDate.Date,
            $"Factura de Compra {ap.InvoiceNumber} – {ap.SupplierName}",
            ap.InvoiceNumber,
            JournalEntrySource.Compra, id, lines));

        await _ctx.SaveChangesAsync();
    }

    // ── 3. Customer Receipt ───────────────────────────────────────────────────
    // DEBE  Caja or Banco (resolved by payment method) = receipt.TotalReceived
    // HABER AR_CLIENTES                                = receipt.TotalReceived
    public async Task PostARSalesReceiptAsync(int id)
    {
        if (await _ctx.JournalEntries.AnyAsync(j =>
                j.SourceType == JournalEntrySource.Cobro && j.SourceId == id))
            return;

        var receipt = await _ctx.ARSalesReceipts.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);
        if (receipt == null) return;

        var arAccountId = await Cfg("AR_CLIENTES");
        if (arAccountId == null) return;

        var cashBankId = await ResolveCashBankAsync(receipt.PaymentMethod);
        if (cashBankId == null) return;

        var lines = new List<JournalEntryLine>
        {
            new() { AccountId = cashBankId.Value,    Debit = receipt.TotalReceived, Credit = 0,
                    Description = $"Recibo {receipt.DocNumber}" },
            new() { AccountId = arAccountId.Value,   Debit = 0, Credit = receipt.TotalReceived,
                    Description = $"Recibo {receipt.DocNumber}" }
        };

        if (!IsBalanced(lines)) return;

        _ctx.JournalEntries.Add(BuildEntry(
            receipt.ReceiptDate.Date,
            $"Cobro – Recibo {receipt.DocNumber}",
            receipt.FiscalFullNumber ?? receipt.DocNumber,
            JournalEntrySource.Cobro, id, lines));

        await _ctx.SaveChangesAsync();
    }

    // ── 4. Payment Made ───────────────────────────────────────────────────────
    // DEBE  AP_PROVEEDORES                             = pay.TotalAmount
    // HABER Caja or Banco (resolved by payment method) = pay.TotalAmount
    public async Task PostPaymentMadeAsync(int id)
    {
        if (await _ctx.JournalEntries.AnyAsync(j =>
                j.SourceType == JournalEntrySource.Pago && j.SourceId == id))
            return;

        var pay = await _ctx.PaymentsMade.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);
        if (pay == null) return;

        var apAccountId = await Cfg("AP_PROVEEDORES");
        if (apAccountId == null) return;

        var cashBankId = await ResolveCashBankAsync(pay.Method);
        if (cashBankId == null) return;

        var lines = new List<JournalEntryLine>
        {
            new() { AccountId = apAccountId.Value, Debit = pay.TotalAmount, Credit = 0,
                    Description = $"Pago #{pay.Id} – {pay.PayeeName}" },
            new() { AccountId = cashBankId.Value,  Debit = 0, Credit = pay.TotalAmount,
                    Description = $"Pago #{pay.Id}" }
        };

        if (!IsBalanced(lines)) return;

        _ctx.JournalEntries.Add(BuildEntry(
            pay.PaymentDate.Date,
            $"Pago a {pay.PayeeName}",
            pay.Reference,
            JournalEntrySource.Pago, id, lines));

        await _ctx.SaveChangesAsync();
    }

    // ── Resolve cash/bank account by payment method ───────────────────────────
    private async Task<int?> ResolveCashBankAsync(string? method)
    {
        var m = (method ?? "CASH").ToUpperInvariant();
        if (m == "CASH")
        {
            var box = await _ctx.CashBoxes.AsNoTracking()
                .Where(c => c.IsActive && c.AccountId != null)
                .OrderBy(c => c.Id)
                .FirstOrDefaultAsync();
            return box?.AccountId;
        }
        else
        {
            var bank = await _ctx.BankAccounts.AsNoTracking()
                .Where(b => b.IsActive && b.AccountId != null)
                .OrderBy(b => b.Id)
                .FirstOrDefaultAsync();
            return bank?.AccountId;
        }
    }

    private static bool IsBalanced(List<JournalEntryLine> lines)
    {
        var d = lines.Sum(l => l.Debit);
        var c = lines.Sum(l => l.Credit);
        return Math.Abs(d - c) < 0.01m;
    }
}
