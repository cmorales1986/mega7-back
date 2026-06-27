using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class SalesDeliveryLine
    {
        public int Id { get; set; }

        public int SalesDeliveryId { get; set; }
        public SalesDelivery? SalesDelivery { get; set; }

        // Referencia a línea de OV (null = línea directa sin OV)
        public int? SalesOrderLineId { get; set; }
        public SalesOrderLine? SalesOrderLine { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

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

        [MaxLength(100)]
        public string? BatchNumber { get; set; }

        public string? SerialNumbers { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; }
    }
}
