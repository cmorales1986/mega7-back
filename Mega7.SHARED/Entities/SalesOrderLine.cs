using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class SalesOrderLine
    {
        public int Id { get; set; }

        public int SalesOrderId { get; set; }
        public SalesOrder? SalesOrder { get; set; }

        // Producto
        public int ProductId { get; set; }
        public Product? Product { get; set; }

        [MaxLength(50)]
        public string ProductCode { get; set; } = string.Empty; // snapshot

        [MaxLength(200)]
        public string ProductName { get; set; } = string.Empty; // snapshot

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountPercent { get; set; } // 0..100

        public int? TaxId { get; set; }
        public Tax? Tax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineSubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; }

        // Para facturación parcial (igual concepto que ReceivedQuantity en compras)
        [Column(TypeName = "decimal(18,4)")]
        public decimal InvoicedQuantity { get; set; } = 0m;

        public decimal UnitPriceBase { get; set; }        // Precio según reglas
        public decimal DiscountPct { get; set; }          // % descuento
        public decimal DiscountAmount { get; set; }       // Monto descuento
        public decimal UnitPriceFinal { get; set; }       // Precio que se factura
    }
}
