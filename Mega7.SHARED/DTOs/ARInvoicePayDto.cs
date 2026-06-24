namespace Mega7.SHARED.DTOs
{
    public class ARInvoicePayDto
    {
        public DateTime? PaymentDate { get; set; }
        public decimal Amount { get; set; }

        public string? Method { get; set; }      // CASH|TRANSFER|CHECK|CARD|OTHER
        public string? Reference { get; set; }
        public string? Notes { get; set; }

        // ✅ opcional: pagar una cuota específica
        public int? InstallmentId { get; set; }
        public bool ApplyExcessToNext { get; set; } = true;
    }

    public class ARInvoiceCancelPaymentDto
    {
        public string? Reason { get; set; }
        public int? CancelledByUserId { get; set; } // si manejás userId
    }
}
