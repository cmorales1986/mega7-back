using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class PurchaseReceiptLine
    {
        public int Id { get; set; }

        public int PurchaseReceiptId { get; set; }
        public PurchaseReceipt? PurchaseReceipt { get; set; }

        // Referencia a línea de OC (null = línea directa sin OC)
        public int? PurchaseOrderLineId { get; set; }
        public PurchaseOrderLine? PurchaseOrderLine { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        [MaxLength(50)]
        public string ProductCode { get; set; } = string.Empty;

        [MaxLength(200)]
        public string ProductName { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; } // cantidad recibida

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountPercent { get; set; }

        public int? TaxId { get; set; }
        public Tax? Tax { get; set; }

        // Lotes / series (si corresponde)
        [MaxLength(100)]
        public string? BatchNumber { get; set; }

        public DateTime? ExpirationDate { get; set; }

        // CSV: "SN001,SN002"
        public string? SerialNumbers { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineSubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; }
    }
}
