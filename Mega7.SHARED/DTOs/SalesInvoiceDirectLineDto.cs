namespace Mega7.SHARED.DTOs
{
    public class SalesInvoiceDirectLineDto
    {
        // "ITEM" (default) o "SERVICE"
        public string? LineType       { get; set; }
        // SERVICE: descripción del servicio
        public string? Description    { get; set; }
        // ITEM: producto requerido
        public int?    ProductId      { get; set; }
        public decimal Quantity        { get; set; }
        public decimal UnitPrice       { get; set; }
        public decimal DiscountPercent { get; set; }
        public int?    TaxId           { get; set; }
        public string? BatchNumber     { get; set; }
        public string? SerialNumbers   { get; set; }
    }
}
