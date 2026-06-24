namespace Mega7.SHARED.DTOs
{
    public class QuotePdfPreviewRequestDto
    {
        // Cabecera (solo para mostrar en el PDF)
        public DateTime OrderDate { get; set; }
        public int CustomerId { get; set; }
        public int WarehouseId { get; set; }
        public string? Comments { get; set; }

        // PDF options
        public bool IncludeCash { get; set; } = true;
        public bool IncludeCredit { get; set; } = true;
        public bool IncludeInstallments { get; set; } = true;

        public decimal DiscountPct { get; set; } = 0m;

        // Crédito
        public int? CreditTermId { get; set; }

        // Cuotas
        public int InstallmentsCount { get; set; } = 12;
        public int? InstallmentIntervalDays { get; set; } = 30;

        public List<QuotePdfPreviewLineDto> Lines { get; set; } = new();
    }

    public class QuotePdfPreviewLineDto
    {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; } // precio actual en pantalla (si MANUAL se respeta)
        public decimal DiscountPercent { get; set; } = 0m;
        public int? TaxId { get; set; }

        // "MANUAL" o "SUGGESTED"
        public string PriceSource { get; set; } = "SUGGESTED";
    }
}
