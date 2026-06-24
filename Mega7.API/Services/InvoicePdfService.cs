using Mega7.API.Data;
using Mega7.API.Pdf;
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

    public async Task<byte[]> RenderSalesInvoicePdf(int id)
    {
        var inv = await _ctx.ARInvoices
            .AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (inv == null) throw new Exception("Factura no existe.");

        var logoPath = Path.Combine(_env.ContentRootPath, "Reports", "logo.png");

        // QuestPDF (liviano, sin Chromium): genera el PDF en memoria.
        var document = new SalesInvoicePdf(inv, logoPath);
        return document.GeneratePdf();
    }
}
