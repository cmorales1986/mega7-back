namespace Mega7.SHARED.DTOs
{
    public class SalesInvoiceDirectLineDto
    {
        public int     ProductId       { get; set; }
        public decimal Quantity        { get; set; }
        public decimal UnitPrice       { get; set; }
        public decimal DiscountPercent { get; set; }
        public int?    TaxId           { get; set; }
        public string? BatchNumber     { get; set; }
        public string? SerialNumbers   { get; set; }
    }
}
