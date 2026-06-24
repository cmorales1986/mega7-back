using System.Globalization;
using Mega7.SHARED.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Mega7.API.Pdf
{
    // Factura de venta en QuestPDF (reemplazo del render con Playwright/Chromium).
    public class SalesInvoicePdf : IDocument
    {
        private readonly ARInvoice _inv;
        private readonly string? _logoPath;

        // Datos de empresa (TODO: traer de FiscalSettings cuando exista)
        private const string CompanyName = "MEGA7 S.A.";
        private const string CompanyRuc = "80000000-0";
        private const string CompanyAddress = "Asunción - Paraguay";
        private const string CompanyPhone = "0981 000 000";

        private static readonly CultureInfo Culture = new("es-PY");

        public SalesInvoicePdf(ARInvoice inv, string? logoPath = null)
        {
            _inv = inv;
            _logoPath = logoPath;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        private static string Money(decimal n) => n.ToString("#,##0", Culture);
        private static string Date(DateTime d) => d.ToString("dd/MM/yyyy", Culture);

        public void Compose(IDocumentContainer container)
        {
            var timbrado = _inv.FiscalTimbrado ?? "12345678";
            var establishment = _inv.FiscalEstablishment ?? "001";
            var expeditionPoint = _inv.FiscalExpeditionPoint ?? "001";
            var fullNumber = _inv.FiscalFullNumber
                ?? $"{establishment}-{expeditionPoint}-{(_inv.FiscalNumber ?? 0):D7}";

            container.Page(page =>
            {
                page.Margin(25);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

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
                        col.Item().AlignCenter().Text("FACTURA").FontSize(13).SemiBold();
                        col.Item().AlignCenter().Text(fullNumber).SemiBold();
                        col.Item().PaddingTop(4).Text($"Timbrado: {timbrado}");
                        col.Item().Text($"Fecha: {Date(_inv.InvoiceDate)}");
                    });
                });

                page.Content().PaddingTop(12).Column(col =>
                {
                    // Datos del cliente
                    col.Item().Border(1).Padding(6).Column(c =>
                    {
                        c.Item().Text($"Cliente: {_inv.CustomerName}").SemiBold();
                        c.Item().Text($"RUC/CI: {_inv.Customer?.RUC ?? _inv.Customer?.Code ?? ""}");
                        c.Item().Text($"Dirección: {_inv.Customer?.Direccion ?? ""}");
                        if (_inv.DueDate.HasValue)
                            c.Item().Text($"Vencimiento: {Date(_inv.DueDate.Value)}");
                    });

                    col.Item().PaddingTop(10).Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(2); // código
                            c.RelativeColumn(6); // producto
                            c.RelativeColumn(2); // cant
                            c.RelativeColumn(2); // precio
                            c.RelativeColumn(2); // desc
                            c.RelativeColumn(2); // total
                        });

                        t.Header(h =>
                        {
                            h.Cell().Text("Código").SemiBold();
                            h.Cell().Text("Producto").SemiBold();
                            h.Cell().AlignRight().Text("Cant.").SemiBold();
                            h.Cell().AlignRight().Text("Precio").SemiBold();
                            h.Cell().AlignRight().Text("Desc.%").SemiBold();
                            h.Cell().AlignRight().Text("Total").SemiBold();
                        });

                        foreach (var l in _inv.Lines)
                        {
                            t.Cell().Text(l.ProductCode);
                            t.Cell().Text(l.ProductName);
                            t.Cell().AlignRight().Text(l.Quantity.ToString("0.##"));
                            t.Cell().AlignRight().Text(Money(l.UnitPrice));
                            t.Cell().AlignRight().Text(l.DiscountPercent.ToString("0.##"));
                            t.Cell().AlignRight().Text(Money(l.LineTotal));
                        }
                    });

                    col.Item().PaddingTop(10).AlignRight().Column(tot =>
                    {
                        tot.Item().Text($"Subtotal: {Money(_inv.SubTotal)}");
                        tot.Item().Text($"Impuestos: {Money(_inv.TaxTotal)}");
                        tot.Item().Text($"Total: {Money(_inv.Total)}").FontSize(12).SemiBold();
                    });

                    if (!string.IsNullOrWhiteSpace(_inv.Comments))
                        col.Item().PaddingTop(10).Text($"Observaciones: {_inv.Comments}");
                });

                page.Footer().AlignCenter().Text(txt =>
                {
                    txt.Span($"{CompanyName}   ");
                    txt.Span(DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                });
            });
        }
    }
}
