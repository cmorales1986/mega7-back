using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class PaymentMadeApply
    {
        public int Id { get; set; }

        public int PaymentMadeId { get; set; }
        public PaymentMade? PaymentMade { get; set; }

        public int APInvoiceId { get; set; }
        public APInvoice? APInvoice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        // opcional: aplicar a una cuota específica (mismo concepto que APInvoicePayment.TargetInstallmentId)
        public int? TargetInstallmentId { get; set; }
        public bool ApplyExcessToNext { get; set; } = true;
    }
}
