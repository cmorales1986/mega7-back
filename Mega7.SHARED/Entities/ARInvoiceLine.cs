using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class ARInvoiceLine
    {
        public int Id { get; set; }

        public int ARInvoiceId { get; set; }
        public ARInvoice? ARInvoice { get; set; }

        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        // "ITEM" | "SERVICE" — null se trata como ITEM (retrocompatible)
        [MaxLength(10)]
        public string? LineType { get; set; }

        [MaxLength(50)]
        public string ProductCode { get; set; } = string.Empty;

        [MaxLength(200)]
        public string ProductName { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountPercent { get; set; }

        public int? TaxId { get; set; }
        public Tax? Tax { get; set; }

        // Para lotes/serial en la salida (se elige al facturar)
        [MaxLength(100)]
        public string? BatchNumber { get; set; }

        [MaxLength(2000)]
        public string? SerialNumbers { get; set; } // "SN1,SN2,..."

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineSubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; }


    }
}
