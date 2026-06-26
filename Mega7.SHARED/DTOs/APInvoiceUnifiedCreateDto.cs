using System;
using System.Collections.Generic;

namespace Mega7.SHARED.DTOs
{
    public class APInvoiceUnifiedCreateDto
    {
        public int      SupplierId    { get; set; }
        public string   InvoiceNumber { get; set; } = string.Empty;
        public DateTime InvoiceDate   { get; set; }
        public DateTime? DueDate      { get; set; }
        public string?  Notes         { get; set; }

        // Links opcionales a documentos base
        public int? PurchaseReceiptId { get; set; }  // Remisión existente
        public int? PurchaseOrderId   { get; set; }  // OC directa

        // Depósito por defecto para líneas ITEM (puede sobrescribirse por línea)
        public int? WarehouseId { get; set; }

        public List<APInvoiceUnifiedLineDto> Lines { get; set; } = new();
    }

    public class APInvoiceUnifiedLineDto
    {
        // "ITEM" | "SERVICE"
        public string LineType { get; set; } = "SERVICE";

        // SERVICE
        public string? Description { get; set; }

        // ITEM
        public int?    ProductId       { get; set; }
        public int?    WarehouseId     { get; set; }   // sobreescribe header si se envía
        public string? BatchNumber     { get; set; }
        public DateTime? ExpirationDate{ get; set; }
        public string? SerialNumbers   { get; set; }

        // Comunes
        public decimal  Quantity        { get; set; }
        public decimal  UnitPrice       { get; set; }
        public decimal  DiscountPercent { get; set; }
        public int?     TaxId           { get; set; }
    }
}
