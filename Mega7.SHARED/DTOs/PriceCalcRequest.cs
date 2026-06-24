using Mega7.SHARED.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PriceCalcRequest
    {
        public decimal Cost { get; set; }
        public int? CustomerId { get; set; }
        public PaymentType PaymentType { get; set; }

        // ===== Crédito =====
        // Usa tu entidad CreditTerm (Id). Ej: "7 días", "15 días", etc.
        public int? CreditTermId { get; set; }

        // ===== Cuotas =====
        public int? InstallmentsCount { get; set; }
        public int? InstallmentIntervalDays { get; set; } // opcional (7/15/30). null = cualquiera

        // ===== Mora =====
        public DateTime? DueDate { get; set; }     // fecha vencimiento
        public DateTime? PaymentDate { get; set; } // si null, usa DateTime.UtcNow para cálculo
    }
}
