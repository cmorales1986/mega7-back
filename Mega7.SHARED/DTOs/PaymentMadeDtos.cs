using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Mega7.SHARED.DTOs
{
    public class PaymentMadeApplyDto
    {
        [Range(1, int.MaxValue)]
        public int APInvoiceId { get; set; }

        public decimal Amount { get; set; }

        public int? TargetInstallmentId { get; set; }

        public bool ApplyExcessToNext { get; set; } = true;
    }

    public class PaymentMadeCreateDto
    {
        public DateTime? PaymentDate { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int PaymentConceptId { get; set; }

        public int? SupplierId { get; set; }
        public string? PayeeName { get; set; }

        // CASH | TRANSFER | CHECK | CARD | OTHER
        public string? Method { get; set; }

        public string? Reference { get; set; }
        public string? Notes { get; set; }

        [Range(typeof(decimal), "0", "999999999999")]
        public decimal TotalAmount { get; set; }

        // ✅ ESTO ES LO QUE TE FALTA (el controller usa dto.Applies)
        public List<PaymentMadeApplyDto>? Applies { get; set; }
    }

    public class CancelDto
    {
        [MaxLength(200)]
        public string? Reason { get; set; }
    }
}
