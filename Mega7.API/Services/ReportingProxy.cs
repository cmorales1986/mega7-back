using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Mega7.API.Data;
using Mega7.SHARED.Entities;

namespace Mega7.API.Services
{
    public class ReportingProxy
    {
        private readonly IHttpClientFactory _httpFactory;
        private readonly IConfiguration _cfg;

        public ReportingProxy(IHttpClientFactory httpFactory, IConfiguration cfg)
        {
            _httpFactory = httpFactory;
            _cfg = cfg;
        }

        public async Task<byte[]> RenderSalesInvoicePdfAsync(int id, Mega7DbContext db)
        {
            var inv = await db.ARInvoices
                .AsNoTracking()
                .Include(x => x.Customer)
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (inv == null)
                throw new Exception($"No existe ARInvoice {id}");

            var reqBody = new
            {
                header = new
                {
                    companyName = "MEGA 7 E.A.S.",
                    docTitle = "FACTURA VENTA",
                    fiscalFullNumber = inv.FiscalFullNumber ?? inv.DocNumber,
                    timbrado = inv.FiscalTimbrado ?? "",
                    invoiceDate = inv.InvoiceDate,
                    dueDate = inv.DueDate ?? inv.InvoiceDate,
                    customerName = inv.CustomerName,
                    customerRuc = inv.Customer?.RUC ?? "",
                    subTotal = inv.SubTotal,
                    taxTotal = inv.TaxTotal,
                    total = inv.Total,
                    comments = inv.Comments
                },
                lines = (inv.Lines ?? new List<ARInvoiceLine>())
                    .Select((l, idx) => new
                    {
                        lineNum = idx + 1,
                        productCode = l.ProductCode,
                        productName = l.ProductName,
                        quantity = l.Quantity,
                        unitPrice = l.UnitPrice,
                        discountPercent = l.DiscountPercent,
                        lineTotal = l.LineTotal,
                        batchNumber = l.BatchNumber,
                        serialNumbers = l.SerialNumbers
                    })
                    .ToList()
            };

            var client = _httpFactory.CreateClient("Reporting");

            var key = _cfg["Reporting:ApiKey"];
            if (string.IsNullOrWhiteSpace(key))
                throw new InvalidOperationException("Reporting:ApiKey no configurado.");

            var req = new HttpRequestMessage(HttpMethod.Post, "/api/render/sales-invoice/pdf");
            req.Headers.Add("X-Reporting-Key", key);
            req.Content = JsonContent.Create(reqBody);

            var resp = await client.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                throw new Exception($"ReportingService error {(int)resp.StatusCode}: {body}");
            }

            return await resp.Content.ReadAsByteArrayAsync();
        }

        public async Task<byte[]> RenderSalesReceiptPdfAsync(int receiptId, Mega7DbContext db)
        {
            var r = await db.Set<ARSalesReceipt>()
                .AsNoTracking()
                .Include(x => x.Lines)
                .FirstOrDefaultAsync(x => x.Id == receiptId);

            if (r == null)
                throw new Exception($"No existe ARSalesReceipt {receiptId}");

            // Traer facturas de las líneas (para mostrar totales/saldos si querés)
            var invIds = r.Lines.Select(l => l.ARInvoiceId).Distinct().ToList();

            var invoices = await db.ARInvoices
                .AsNoTracking()
                .Where(i => invIds.Contains(i.Id))
                .ToListAsync();

            var reqBody = new
            {
                header = new
                {
                    companyName = "MEGA 7 E.A.S.",
                    docTitle = "RECIBO DE VENTA",
                    fiscalFullNumber = r.FiscalFullNumber ?? r.DocNumber,
                    timbrado = r.FiscalTimbrado ?? "",
                    receiptDate = r.ReceiptDate,
                    customerName = r.CustomerName,
                    customerRuc = r.CustomerRuc ?? "",
                    paymentMethod = r.PaymentMethod,
                    paymentReference = r.PaymentReference ?? "",
                    totalReceived = r.TotalReceived,
                    notes = r.Notes
                },
                lines = r.Lines
                    .Select((l, idx) =>
                    {
                        var inv = invoices.FirstOrDefault(x => x.Id == l.ARInvoiceId);
                        return new
                        {
                            lineNum = idx + 1,
                            invoiceNumber = l.InvoiceFiscalNumber ?? l.InvoiceDocNumber ?? (inv?.FiscalFullNumber ?? inv?.DocNumber ?? $"#{l.ARInvoiceId}"),
                            invoiceDate = inv?.InvoiceDate,
                            invoiceTotal = inv?.Total ?? 0m,
                            invoiceBalance = inv?.Balance ?? 0m,
                            appliedAmount = l.AppliedAmount
                        };
                    })
                    .ToList()
            };

            var client = _httpFactory.CreateClient("Reporting");

            var key = _cfg["Reporting:ApiKey"];
            if (string.IsNullOrWhiteSpace(key))
                throw new InvalidOperationException("Reporting:ApiKey no configurado.");

            var req = new HttpRequestMessage(HttpMethod.Post, "/api/render/sales-receipt/pdf");
            req.Headers.Add("X-Reporting-Key", key);
            req.Content = JsonContent.Create(reqBody);

            var resp = await client.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                throw new Exception($"ReportingService error {(int)resp.StatusCode}: {body}");
            }

            return await resp.Content.ReadAsByteArrayAsync();
        }

    }
}
