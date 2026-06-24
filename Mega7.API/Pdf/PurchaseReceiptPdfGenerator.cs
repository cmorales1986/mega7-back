using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Mega7.SHARED.Entities;

namespace Mega7.API.Services.Pdf
{
    public static class PurchaseReceiptPdfGenerator
    {
        public static byte[] Generate(PurchaseReceipt doc, byte[]? logoBytes)
        {
            var culture = new CultureInfo("es-PY");

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(25);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    page.Header().Row(row =>
                    {
                        row.ConstantColumn(120).Height(50).AlignLeft().AlignMiddle().Element(e =>
                        {
                            if (logoBytes != null)
                                e.Image(logoBytes).FitArea(); // ✅ evita DocumentLayoutException
                            else
                                e.Text("Mega7").Bold().FontSize(20);
                        });

                        row.RelativeColumn().AlignRight().AlignMiddle().Column(col =>
                        {
                            col.Item().Text("RECEPCIÓN DE COMPRA").Bold().FontSize(16);
                            col.Item().Text($"N°: {doc.DocNumber}").SemiBold();
                            col.Item().Text($"Fecha: {doc.ReceiptDate:yyyy-MM-dd}");
                            col.Item().Text($"Estado: {(doc.IsCancelled ? "CANCELLED" : (doc.Status ?? "POSTED"))}");
                        });
                    });

                    page.Content().PaddingTop(10).Column(col =>
                    {
                        col.Item().Border(1).Padding(10).Column(h =>
                        {
                            h.Item().Text($"Proveedor: {doc.SupplierName}").SemiBold();
                            h.Item().Text($"Depósito: {doc.Warehouse?.Name ?? ""}");
                            h.Item().Text($"OC: {doc.PurchaseOrder?.DocNumber ?? ""}");
                            if (!string.IsNullOrWhiteSpace(doc.Comments))
                                h.Item().Text($"Obs: {doc.Comments}");
                        });

                        if (doc.Documents != null && doc.Documents.Count > 0)
                        {
                            col.Item().PaddingTop(8).Text("Documentos asociados").Bold();
                            col.Item().Border(1).Padding(8).Table(t =>
                            {
                                t.ColumnsDefinition(c =>
                                {
                                    c.RelativeColumn();
                                    c.RelativeColumn();
                                    c.RelativeColumn();
                                });

                                t.Header(h =>
                                {
                                    h.Cell().Text("Tipo").Bold();
                                    h.Cell().Text("Número").Bold();
                                    h.Cell().Text("Fecha").Bold();
                                });

                                foreach (var d in doc.Documents.OrderBy(x => x.Type))
                                {
                                    t.Cell().Text(d.Type ?? "");
                                    t.Cell().Text(d.Number ?? "");
                                    t.Cell().Text(d.Date.HasValue ? d.Date.Value.ToString("yyyy-MM-dd") : "");
                                }
                            });
                        }

                        col.Item().PaddingTop(10).Text("Detalle").Bold();

                        col.Item().Border(1).Padding(8).Table(t =>
                        {
                            t.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(70);
                                c.RelativeColumn(2);
                                c.ConstantColumn(55);
                                c.ConstantColumn(70);
                                c.ConstantColumn(70);
                                c.ConstantColumn(55);
                                c.ConstantColumn(70);
                            });

                            t.Header(h =>
                            {
                                h.Cell().Text("Código").Bold();
                                h.Cell().Text("Producto").Bold();
                                h.Cell().AlignRight().Text("Cant").Bold();
                                h.Cell().AlignRight().Text("Precio").Bold();
                                h.Cell().AlignRight().Text("Subt").Bold();
                                h.Cell().AlignRight().Text("IVA").Bold();
                                h.Cell().AlignRight().Text("Total").Bold();
                            });

                            foreach (var l in doc.Lines)
                            {
                                t.Cell().Text(l.ProductCode ?? "");
                                t.Cell().Column(c =>
                                {
                                    c.Item().Text(l.ProductName ?? "");

                                    if (!string.IsNullOrWhiteSpace(l.BatchNumber))
                                        c.Item().Text($"Lote: {l.BatchNumber}")
                                            .FontSize(9).FontColor(Colors.Grey.Darken2);

                                    if (!string.IsNullOrWhiteSpace(l.SerialNumbers))
                                        c.Item().Text($"Seriales: {l.SerialNumbers}")
                                            .FontSize(9).FontColor(Colors.Grey.Darken2);
                                });

                                t.Cell().AlignRight().Text(l.Quantity.ToString("N2", culture));
                                t.Cell().AlignRight().Text(l.UnitPrice.ToString("N0", culture));
                                t.Cell().AlignRight().Text(l.LineSubTotal.ToString("N0", culture));
                                t.Cell().AlignRight().Text(l.LineTax.ToString("N0", culture));
                                t.Cell().AlignRight().Text(l.LineTotal.ToString("N0", culture));
                            }
                        });

                        col.Item().AlignRight().PaddingTop(10).Column(tot =>
                        {
                            tot.Item().Text($"SubTotal: {doc.SubTotal.ToString("N0", culture)}");
                            tot.Item().Text($"IVA: {doc.TaxTotal.ToString("N0", culture)}");
                            tot.Item().Text($"Total: {doc.Total.ToString("N0", culture)}").Bold().FontSize(12);
                        });

                        if (doc.IsCancelled)
                        {
                            col.Item().PaddingTop(10).Border(1).BorderColor(Colors.Red.Medium).Padding(10).Column(x =>
                            {
                                x.Item().Text("DOCUMENTO CANCELADO").Bold().FontColor(Colors.Red.Medium);
                                x.Item().Text($"Fecha cancelación: {doc.CancelledAt:yyyy-MM-dd HH:mm}");
                                x.Item().Text($"Motivo: {doc.CancelReason ?? ""}");
                                x.Item().Text($"Cancelado por: {doc.CancelledBy ?? ""}");
                            });
                        }
                    });

                    page.Footer().AlignCenter().Text(txt =>
                    {
                        txt.Span("Mega7 - Documento interno").FontSize(9);
                    });
                });
            }).GeneratePdf();
        }
    }
}
