using System;
using System.Collections.Generic;

namespace Mega7.SHARED.DTOs
{
    public class ARSalesReceiptCreateLineDto
    {
        public int ARInvoiceId { get; set; }
        public decimal AppliedAmount { get; set; }

        // opcional: si querés apuntar cuota específica (solo crédito)
        public int? TargetInstallmentId { get; set; }
        public bool ApplyExcessToNext { get; set; } = false;
    }

    public class ARSalesReceiptCreateDto
    {
        public DateTime? ReceiptDate { get; set; }

        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerRuc { get; set; }

        public string? PaymentMethod { get; set; }   // CASH|TRANSFER|CARD|CHECK|OTHER
        public string? PaymentReference { get; set; }
        public string? Notes { get; set; }

        // Opcional: elegir talonario por Id
        public int? FiscalSeriesId { get; set; }

        public List<ARSalesReceiptCreateLineDto> Lines { get; set; } = new();
    }
}
