namespace Mega7.SHARED.DTOs
{
    public class SalesPricingParamsDto
    {
        public int? CustomerId { get; set; } // null = global

        public decimal CashMarkupPct { get; set; }
        public decimal CreditDefaultMarkupPct { get; set; }
        public decimal InstallmentDefaultMarkupPct { get; set; }

        // ✅ mora solo cuotas (monto fijo)
        public decimal LateFeeAmountPerDay { get; set; }
        public int LateFeeGraceDays { get; set; }
        public decimal LateFeeCapAmount { get; set; }
    }
}
