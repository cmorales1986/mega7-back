using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class ARSalesReceiptLine
    {
        public int Id { get; set; }

        public int ARSalesReceiptId { get; set; }
        public ARSalesReceipt? ARSalesReceipt { get; set; }

        public int ARInvoiceId { get; set; }
        public ARInvoice? ARInvoice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AppliedAmount { get; set; }

        // snapshots útiles p/ PDF
        public string? InvoiceDocNumber { get; set; }
        public string? InvoiceFiscalNumber { get; set; }
    }
}
