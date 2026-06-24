using Mega7.SHARED.Enums;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System;
using System.Collections.Generic;

namespace Mega7.API.Pdf
{
    public class QuotePdfPreviewDocument : IDocument
    {
        private readonly QuotePreviewHeader _h;
        private readonly List<QuoteScenarioPreview> _scenarios;
        private readonly decimal _discountPct;

        public QuotePdfPreviewDocument(
            QuotePreviewHeader h,
            List<QuoteScenarioPreview> scenarios,
            decimal discountPct)
        {
            _h = h;
            _scenarios = scenarios;
            _discountPct = discountPct;
        }

        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        public void Compose(IDocumentContainer container)
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Content().Column(col =>
                {
                    for (int i = 0; i < _scenarios.Count; i++)
                    {
                        var sc = _scenarios[i];
                        col.Item().Element(c => ComposeScenario(c, sc));

                        if (i < _scenarios.Count - 1)
                            col.Item().PageBreak();
                    }
                });
            });
        }

        private void ComposeScenario(IContainer container, QuoteScenarioPreview sc)
        {
            container.Column(col =>
            {
                col.Item().Row(r =>
                {
                    r.RelativeItem().Column(c =>
                    {
                        c.Item().Text("MEGA7").FontSize(20).SemiBold();
                        c.Item().Text("COTIZACIÓN / PRESUPUESTO").FontSize(12).SemiBold();
                        c.Item().Text($"Condición: {sc.Title}").FontSize(12).SemiBold();
                    });

                    r.ConstantItem(240).AlignRight().Column(c =>
                    {
                        c.Item().Text($"Asunción, {_h.OrderDate:dd/MM/yyyy}").SemiBold();
                        c.Item().Text($"Depósito: {_h.WarehouseName}");
                    });
                });

                col.Item().PaddingTop(10).Text($"Señores: {_h.CustomerName}").FontSize(11).SemiBold();

                if (!string.IsNullOrWhiteSpace(_h.Comments))
                    col.Item().Text($"Obs: {_h.Comments}");

                if (_discountPct > 0)
                    col.Item().PaddingTop(4).Text($"Descuento global aplicado: {_discountPct}%").Italic();

                col.Item().PaddingTop(10).LineHorizontal(1);

                col.Item().PaddingTop(10).Table(t =>
                {
                    t.ColumnsDefinition(cols =>
                    {
                        cols.ConstantColumn(40);   // qty
                        cols.ConstantColumn(90);   // code
                        cols.RelativeColumn();     // desc
                        cols.ConstantColumn(90);   // unit
                        cols.ConstantColumn(100);  // total
                    });

                    t.Header(h =>
                    {
                        h.Cell().Element(HeaderCell).Text("QTY");
                        h.Cell().Element(HeaderCell).Text("Código");
                        h.Cell().Element(HeaderCell).Text("Descripción");
                        h.Cell().Element(HeaderCell).AlignRight().Text("Precio");
                        h.Cell().Element(HeaderCell).AlignRight().Text("Total");
                    });

                    foreach (var l in sc.Lines)
                    {
                        t.Cell().Element(BodyCell).Text($"{l.Qty:n0}");
                        t.Cell().Element(BodyCell).Text(l.ProductCode);
                        t.Cell().Element(BodyCell).Text(l.Description + (l.IsManual ? " (MANUAL)" : ""));
                        t.Cell().Element(BodyCell).AlignRight().Text($"{l.UnitPrice:n0}");
                        t.Cell().Element(BodyCell).AlignRight().Text($"{l.LineTotal:n0}");
                    }

                    static IContainer HeaderCell(IContainer c)
                        => c.DefaultTextStyle(x => x.SemiBold())
                            .PaddingVertical(6)
                            .BorderBottom(1)
                            .BorderColor(Colors.Grey.Medium);

                    static IContainer BodyCell(IContainer c)
                        => c.PaddingVertical(4)
                            .BorderBottom(1)
                            .BorderColor(Colors.Grey.Lighten2);
                });

                col.Item().PaddingTop(18).AlignCenter()
                    .Text($"TOTAL DEL PRESUPUESTO: {sc.Total:n0} GS")
                    .FontSize(16).SemiBold();

                if (sc.Schedule != null && sc.Schedule.Count > 0)
                {
                    col.Item().PaddingTop(10).Text("Cronograma de cuotas:").SemiBold();

                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(50);
                            cols.ConstantColumn(120);
                            cols.ConstantColumn(120);
                        });

                        t.Header(h =>
                        {
                            h.Cell().Element(x => x.Padding(5).BorderBottom(1)).Text("#").SemiBold();
                            h.Cell().Element(x => x.Padding(5).BorderBottom(1)).Text("Vencimiento").SemiBold();
                            h.Cell().Element(x => x.Padding(5).BorderBottom(1)).AlignRight().Text("Monto").SemiBold();
                        });

                        foreach (var row in sc.Schedule)
                        {
                            t.Cell().Element(x => x.Padding(4)).Text(row.N.ToString());
                            t.Cell().Element(x => x.Padding(4)).Text(row.DueDate.ToString("dd/MM/yyyy"));
                            t.Cell().Element(x => x.Padding(4)).AlignRight().Text($"{row.Amount:n0}");
                        }
                    });
                }

                if (!string.IsNullOrWhiteSpace(sc.RuleInfo))
                    col.Item().PaddingTop(10).Text($"Info regla: {sc.RuleInfo}")
                        .FontSize(9).FontColor(Colors.Grey.Darken2);
            });
        }
    }

    // ===== modelos del PDF =====

    public class QuotePreviewHeader
    {
        public DateTime OrderDate { get; set; }
        public string CustomerName { get; set; } = "";
        public string WarehouseName { get; set; } = "";
        public string? Comments { get; set; }
    }

    public class QuoteScenarioPreview
    {
        public string Title { get; set; } = "";
        public PaymentType PaymentType { get; set; }

        public int? CreditTermId { get; set; }
        public int? InstallmentsCount { get; set; }
        public int? InstallmentIntervalDays { get; set; }

        public string? RuleInfo { get; set; }

        public decimal SubTotal { get; set; }
        public decimal TaxTotal { get; set; }
        public decimal Total { get; set; }

        public List<QuoteScenarioLinePreview> Lines { get; set; } = new();
        public List<InstallmentRow>? Schedule { get; set; }
    }

    public class QuoteScenarioLinePreview
    {
        public decimal Qty { get; set; }
        public string ProductCode { get; set; } = "";
        public string Description { get; set; } = "";
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
        public bool IsManual { get; set; }
    }

    public class InstallmentRow
    {
        public int N { get; set; }
        public DateTime DueDate { get; set; }
        public decimal Amount { get; set; }
    }
}
