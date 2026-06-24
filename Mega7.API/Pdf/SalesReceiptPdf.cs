using System.Globalization;
using Mega7.SHARED.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Mega7.API.Pdf
{
    public class SalesReceiptPdf : IDocument
    {
        private readonly ARSalesReceipt _r;
        private readonly IReadOnlyList<ARInvoice> _invoices;
        private readonly string? _logoPath;

        private const string CompanyName = "MEGA7 S.A.";
        private const string CompanyRuc  = "80000000-0";
        private const string CompanyAddress = "Asunción - Paraguay";
        private const string CompanyPhone   = "0981 000 000";

        private static readonly CultureInfo Culture = new("es-PY");
        private static string Money(decimal n) => n.ToString("#,##0", Culture);
        private static string Date(DateTime d)  => d.ToString("dd/MM/yyyy", Culture);

        public SalesReceiptPdf(ARSalesReceipt r, IReadOnlyList<ARInvoice> invoices, string? logoPath = null)
        {
            _r        = r;
            _invoices = invoices;
            _logoPath = logoPath;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        public void Compose(IDocumentContainer container)
        {
            var fullNumber = _r.FiscalFullNumber ?? _r.DocNumber;
            var timbrado   = _r.FiscalTimbrado ?? "";

            container.Page(page =>
            {
                page.Margin(25);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                // ── HEADER ───────────────────────────────────────────────────────────
                page.Header().Row(row =>
                {
                    row.ConstantItem(80).Height(40).Element(c =>
                    {
                        if (!string.IsNullOrWhiteSpace(_logoPath) && File.Exists(_logoPath))
                            c.Image(_logoPath, ImageScaling.FitArea);
                        else
                            c.AlignMiddle().Text(CompanyName).SemiBold();
                    });

                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text(CompanyName).FontSize(16).SemiBold();
                        col.Item().Text($"RUC: {CompanyRuc}");
                        col.Item().Text(CompanyAddress);
                        col.Item().Text($"Tel: {CompanyPhone}");
                    });

                    row.ConstantItem(190).Border(1).Padding(6).Column(col =>
                    {
                        col.Item().AlignCenter().Text("RECIBO DE COBRO").FontSize(13).SemiBold();
                        col.Item().AlignCenter().Text(fullNumber).SemiBold();
                        if (!string.IsNullOrWhiteSpace(timbrado))
                            col.Item().PaddingTop(4).Text($"Timbrado: {timbrado}");
                        col.Item().Text($"Fecha: {Date(_r.ReceiptDate)}");
                    });
                });

                // ── CONTENT ──────────────────────────────────────────────────────────
                page.Content().PaddingTop(12).Column(col =>
                {
                    // Datos del cliente
                    col.Item().Border(1).Padding(6).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Cliente: {_r.CustomerName}").SemiBold();
                            if (!string.IsNullOrWhiteSpace(_r.CustomerRuc))
                                c.Item().Text($"RUC/CI: {_r.CustomerRuc}");
                        });

                        row.ConstantItem(200).Column(c =>
                        {
                            c.Item().Text($"Método de pago: {_r.PaymentMethod}");
                            if (!string.IsNullOrWhiteSpace(_r.PaymentReference))
                                c.Item().Text($"Referencia: {_r.PaymentReference}");
                        });
                    });

                    // Tabla de facturas aplicadas
                    col.Item().PaddingTop(10).Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(1);  // #
                            c.RelativeColumn(4);  // Factura
                            c.RelativeColumn(3);  // Fecha fact.
                            c.RelativeColumn(3);  // Total fact.
                            c.RelativeColumn(3);  // Saldo fact.
                            c.RelativeColumn(3);  // Importe aplicado
                        });

                        t.Header(h =>
                        {
                            static void H(IContainer c, string txt) =>
                                c.Background("#e8e8e8").Padding(4).Text(txt).SemiBold();

                            H(h.Cell(), "#");
                            H(h.Cell(), "Factura");
                            H(h.Cell(), "Fecha");
                            H(h.Cell().AlignRight(), "Total");
                            H(h.Cell().AlignRight(), "Saldo");
                            H(h.Cell().AlignRight(), "Aplicado");
                        });

                        var lines = _r.Lines ?? new List<ARSalesReceiptLine>();
                        for (int i = 0; i < lines.Count; i++)
                        {
                            var l   = lines[i];
                            var inv = _invoices.FirstOrDefault(x => x.Id == l.ARInvoiceId);
                            var fv  = l.InvoiceFiscalNumber ?? l.InvoiceDocNumber
                                      ?? inv?.FiscalFullNumber ?? inv?.DocNumber
                                      ?? $"#{l.ARInvoiceId}";

                            t.Cell().Padding(4).Text((i + 1).ToString());
                            t.Cell().Padding(4).Text(fv);
                            t.Cell().Padding(4).Text(inv != null ? Date(inv.InvoiceDate) : "");
                            t.Cell().AlignRight().Padding(4).Text(inv != null ? Money(inv.Total) : "");
                            t.Cell().AlignRight().Padding(4).Text(inv != null ? Money(inv.Balance) : "");
                            t.Cell().AlignRight().Padding(4).Text(Money(l.AppliedAmount));
                        }
                    });

                    // Total
                    col.Item().PaddingTop(10).AlignRight()
                        .Text($"TOTAL RECIBIDO: {Money(_r.TotalReceived)}")
                        .FontSize(12).SemiBold();

                    if (!string.IsNullOrWhiteSpace(_r.Notes))
                        col.Item().PaddingTop(10).Text($"Observaciones: {_r.Notes}");

                    // Firma
                    col.Item().PaddingTop(40).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().BorderBottom(1).Width(160).Height(30);
                            c.Item().PaddingTop(4).AlignCenter().Text("Firma del cajero").FontSize(8);
                        });
                        row.RelativeItem();
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().BorderBottom(1).Width(160).Height(30);
                            c.Item().PaddingTop(4).AlignCenter().Text("Firma del cliente").FontSize(8);
                        });
                    });
                });

                // ── FOOTER ───────────────────────────────────────────────────────────
                page.Footer().AlignCenter().Text(txt =>
                {
                    txt.Span($"{CompanyName}   ");
                    txt.Span(DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                });
            });
        }
    }
}
