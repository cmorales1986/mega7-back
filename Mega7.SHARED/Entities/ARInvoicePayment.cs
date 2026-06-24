using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class ARInvoicePayment
    {
        public int Id { get; set; }

        public int ARInvoiceId { get; set; }
        public ARInvoice? ARInvoice { get; set; }

        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

        public decimal Amount { get; set; }
        public string Method { get; set; } = "CASH";
        public string? Reference { get; set; }
        public string? Notes { get; set; }

        public bool IsCancelled { get; set; }
        public DateTime? CancelledAt { get; set; }
        public string? CancelReason { get; set; }
        public int? CancelledByUserId { get; set; }
        public string? CancelledBy { get; set; }

        public DateTime CreatedAt { get; set; }
        public string? CreatedBy { get; set; }

        // ✅ NUEVO (Opción B)
        public int? TargetInstallmentId { get; set; }
        public bool ApplyExcessToNext { get; set; } = true;

        public int? ARSalesReceiptId { get; set; }
        public ARSalesReceipt? ARSalesReceipt { get; set; }

    }
}
