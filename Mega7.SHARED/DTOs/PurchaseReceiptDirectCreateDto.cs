using System;
using System.Collections.Generic;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseReceiptDirectCreateDto
    {
        public int      SupplierId  { get; set; }
        public int      WarehouseId { get; set; }
        public DateTime ReceiptDate { get; set; }
        public string?  Comments    { get; set; }

        public List<PurchaseReceiptDirectLineDto> DirectLines { get; set; } = new();

        // Factura del proveedor — si se informa, se registra junto con la recepción
        public string?   InvoiceNumber  { get; set; }
        public DateTime? InvoiceDate    { get; set; }
        public DateTime? InvoiceDueDate { get; set; }
        public bool      IsCredit       { get; set; } = false;
        public int?      CreditTermId   { get; set; }
    }

    public class PurchaseReceiptDirectLineDto
    {
        public int      ProductId       { get; set; }
        public decimal  Quantity        { get; set; }
        public decimal  UnitPrice       { get; set; }
        public decimal  DiscountPercent { get; set; }
        public int?     TaxId           { get; set; }
        public string?  BatchNumber     { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public string?  SerialNumbers   { get; set; }
    }
}
