public class SalesQuotePdfRequestDto
{
    public int CustomerId { get; set; }
    public DateTime QuoteDate { get; set; }

    public bool IncludeCash { get; set; } = true;
    public bool IncludeCredit { get; set; } = true;
    public bool IncludeInstallments { get; set; } = true;

    public int? CreditTermId { get; set; }
    public int InstallmentsCount { get; set; } = 12;
    public int InstallmentIntervalDays { get; set; } = 30;

    public decimal DiscountPct { get; set; } = 0m;

    public List<SalesQuotePdfLineDto> Lines { get; set; } = new();
}

public class SalesQuotePdfLineDto
{
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }

    public decimal DiscountPercent { get; set; } = 0m; // descuento por línea (ya existe)
    public int? TaxId { get; set; } // opcional
    public bool IsManualPrice { get; set; } = false;
    public decimal? ManualUnitPrice { get; set; } // si IsManualPrice=true, usar esto
}
