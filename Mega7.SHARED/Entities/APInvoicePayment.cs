using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class APInvoicePayment
    {
        public int Id { get; set; }
        public int APInvoiceId { get; set; }
        public APInvoice? APInvoice { get; set; }

        public DateTime PaymentDate { get; set; }
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
        public int? PaymentMadeId { get; set; }

    }
}
