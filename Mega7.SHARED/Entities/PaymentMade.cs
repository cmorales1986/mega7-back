using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class PaymentMade
    {
        public int Id { get; set; }

        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

        // Puede ser NULL (sueldos / IPS / impuestos / otros)
        public int? SupplierId { get; set; }

        [MaxLength(200)]
        public string PayeeName { get; set; } = string.Empty;

        // SUPPLIER | PAYROLL | IPS | TAX | OTHER
        // (esto luego lo vamos a reemplazar por PaymentConceptId)
        [MaxLength(30)]
        public int PaymentConceptId { get; set; }
        public PaymentConcept? PaymentConcept { get; set; }

        // CASH | TRANSFER | CHECK | CARD | OTHER
        [MaxLength(30)]
        public string Method { get; set; } = "CASH";

        [MaxLength(100)]
        public string? Reference { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        // ✅ Estado en español
        [MaxLength(20)]
        public string Status { get; set; } = "EMITIDO"; // EMITIDO | ANULADO

        // Auditoría
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string? CreatedBy { get; set; }

        public DateTime? CancelledAt { get; set; }
        public string? CancelReason { get; set; }
        public string? CancelledBy { get; set; }

        public List<PaymentMadeApply> Applies { get; set; } = new();
    }
}
