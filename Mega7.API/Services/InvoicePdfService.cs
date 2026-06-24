using Mega7.API.Data;
using Mega7.API.Pdf;
using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;

namespace Mega7.API.Services;

public class InvoicePdfService
{
    private readonly Mega7DbContext _ctx;
    private readonly IWebHostEnvironment _env;

    public InvoicePdfService(Mega7DbContext ctx, IWebHostEnvironment env)
    {
        _ctx = ctx;
        _env = env;
    }

    private string LogoPath => Path.Combine(_env.ContentRootPath, "Reports", "logo.png");

    public async Task<byte[]> RenderSalesInvoicePdf(int id)
    {
        var inv = await _ctx.ARInvoices
            .AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new Exception($"Factura {id} no existe.");

        return new SalesInvoicePdf(inv, LogoPath).GeneratePdf();
    }

    public async Task<byte[]> RenderSalesReceiptPdf(int receiptId)
    {
        var r = await _ctx.Set<ARSalesReceipt>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == receiptId)
            ?? throw new Exception($"Recibo {receiptId} no existe.");

        var invIds   = r.Lines.Select(l => l.ARInvoiceId).Distinct().ToList();
        var invoices = await _ctx.ARInvoices
            .AsNoTracking()
            .Where(i => invIds.Contains(i.Id))
            .ToListAsync();

        return new SalesReceiptPdf(r, invoices, LogoPath).GeneratePdf();
    }
}
