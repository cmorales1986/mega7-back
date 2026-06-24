namespace Mega7.SHARED.DTOs
{
    public class PriceCalcResult
    {
        public decimal BaseCost { get; set; }

        public decimal MarkupPctApplied { get; set; }
        public decimal MarkupAmount { get; set; }
        public decimal PriceSuggested { get; set; } // costo + recargo

        public int DaysLate { get; set; } // atraso total (desde dueDate)
        public int ChargedLateDays { get; set; } // ✅ atraso cobrado (post-gracia)
        public decimal LateFeeAmount { get; set; }

        public decimal Total { get; set; } // priceSuggested + mora
        public string? RuleInfo { get; set; } // útil para depurar en UI
    }
}
