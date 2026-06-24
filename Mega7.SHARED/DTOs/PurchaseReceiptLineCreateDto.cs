using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseReceiptLineCreateDto
    {
        public int PurchaseOrderLineId { get; set; }
        public decimal Quantity { get; set; } // cantidad recibida

        // Si querés permitir variar precio al recibir:
        public decimal UnitPrice { get; set; }
        public decimal DiscountPercent { get; set; }
        public int? TaxId { get; set; }

        // Lotes / series
        public string? BatchNumber { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public string? SerialNumbers { get; set; } // "SN1,SN2"
    }
}
