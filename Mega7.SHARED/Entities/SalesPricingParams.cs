using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class SalesPricingParams
    {
        public int Id { get; set; }

        // null = global, != null = override por cliente
        public int? CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        // % base sobre costo
        [Column(TypeName = "decimal(18,2)")]
        public decimal CashMarkupPct { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal CreditDefaultMarkupPct { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InstallmentDefaultMarkupPct { get; set; } = 0m;

        // ✅ Mora: monto fijo por día (aplica solo a cuotas)
        [Column(TypeName = "decimal(18,2)")]
        public decimal LateFeeAmountPerDay { get; set; } = 0m;

        // ✅ Días de gracia antes de aplicar mora (solo cuotas)
        public int LateFeeGraceDays { get; set; } = 0;

        // ✅ Tope opcional de mora total en monto (0 = sin tope)
        [Column(TypeName = "decimal(18,2)")]
        public decimal LateFeeCapAmount { get; set; } = 0m;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
