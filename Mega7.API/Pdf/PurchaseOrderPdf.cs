using Mega7.SHARED.Entities;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using QuestPDF.Helpers;

namespace Mega7.API.Pdf
{
    public class PurchaseOrderPdf : IDocument
    {
        private readonly PurchaseOrder _doc;
        private readonly string _logoPath;

        public PurchaseOrderPdf(PurchaseOrder doc, string logoPath)
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

                page.Header().Row(row =>
                {
                    row.ConstantItem(80).Height(40).Image(_logoPath, ImageScaling.FitArea);
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("Mega7").FontSize(18).SemiBold();
                        col.Item().Text($"Orden de Compra: {_doc.DocNumber}").FontSize(12).SemiBold();
                    });

                    row.ConstantItem(160).Column(col =>
                    {
                        col.Item().AlignRight().Text($"Fecha: {_doc.OrderDate:yyyy-MM-dd}");
                        col.Item().AlignRight().Text($"Estado: {_doc.Status}");
                    });
                });

                page.Content().PaddingTop(10).Column(col =>
                {
                    col.Item().Text($"Proveedor: {_doc.SupplierName}");
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
