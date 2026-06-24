using Mega7.SHARED.Entities;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using QuestPDF.Helpers;

namespace Mega7.API.Pdf
{
    public class SalesOrderPdf : IDocument
    {
        private readonly SalesOrder _doc;
        private readonly string _logoPath;

        public SalesOrderPdf(SalesOrder doc, string logoPath)
        {
            _doc = doc;
            _logoPath = logoPath;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        public void Compose(IDocumentContainer container)
        {
            container.Page(page =>
            {
                page.Margin(25);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                // ✅ igual a PurchaseOrderPdf (sin Element(Header))
                page.Header().Row(row =>
                {
                    row.ConstantItem(80).Height(40).Element(c =>
                    {
                        // ✅ evita crash si la ruta del logo está mal
                        if (!string.IsNullOrWhiteSpace(_logoPath) && File.Exists(_logoPath))
                            c.Image(_logoPath, ImageScaling.FitArea);
                        else
                            c.AlignMiddle().Text("MEGA7").SemiBold();
                    });

                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("Mega7").FontSize(18).SemiBold();
                        col.Item().Text($"Orden de Venta: {_doc.DocNumber}").FontSize(12).SemiBold();
                        // si querés: col.Item().Text("PRESUPUESTO").SemiBold();
                    });

                    row.ConstantItem(170).Column(col =>
                    {
                        col.Item().AlignRight().Text($"Fecha: {_doc.OrderDate:yyyy-MM-dd}");
                        col.Item().AlignRight().Text($"Estado: {_doc.Status}");
                        col.Item().AlignRight().Text($"Cliente: {_doc.CustomerName}");
                    });
                });

                page.Content().PaddingTop(10).Column(col =>
                {
                    col.Item().Text($"Cliente: {_doc.CustomerName}");
                    col.Item().Text($"Depósito: {_doc.Warehouse?.Name ?? ""}");

                    if (!string.IsNullOrWhiteSpace(_doc.Comments))
                        col.Item().Text($"Comentarios: {_doc.Comments}");

                    col.Item().PaddingTop(10).Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(2);
                            c.RelativeColumn(6);
                            c.RelativeColumn(2);
                            c.RelativeColumn(2);
                            c.RelativeColumn(2);
                        });

                        t.Header(h =>
                        {
                            h.Cell().Text("Código").SemiBold();
                            h.Cell().Text("Producto").SemiBold();
                            h.Cell().AlignRight().Text("Cant.").SemiBold();
                            h.Cell().AlignRight().Text("Precio").SemiBold();
                            h.Cell().AlignRight().Text("Total").SemiBold();
                        });

                        foreach (var l in _doc.Lines)
                        {
                            t.Cell().Text(l.ProductCode);
                            t.Cell().Text(l.ProductName);
                            t.Cell().AlignRight().Text(l.Quantity.ToString("0.##"));
                            t.Cell().AlignRight().Text(l.UnitPrice.ToString("N0"));
                            t.Cell().AlignRight().Text(l.LineTotal.ToString("N0"));
                        }
                    });

                    col.Item().PaddingTop(10).AlignRight().Column(tot =>
                    {
                        tot.Item().Text($"Subtotal: {_doc.SubTotal:N0}");
                        tot.Item().Text($"Impuestos: {_doc.TaxTotal:N0}");
                        tot.Item().Text($"Total: {_doc.Total:N0}").SemiBold();
                    });
                });

                page.Footer().AlignCenter().Text(txt =>
                {
                    txt.Span("Documento interno - Mega7   ");
                    txt.Span(DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                });
            });
        }
    }
}
