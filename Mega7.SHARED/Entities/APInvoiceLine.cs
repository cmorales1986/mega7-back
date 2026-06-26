using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class APInvoiceLine
    {
        public int Id { get; set; }

        public int APInvoiceId { get; set; }
        public APInvoice? APInvoice { get; set; }

        // "ITEM" = producto de inventario (actualiza stock) | "SERVICE" = servicio
        [MaxLength(20)]
        public string LineType { get; set; } = "SERVICE";

        // Para SERVICE: descripción libre
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        // Para ITEM: referencia a producto
        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        [MaxLength(50)]
        public string? ProductCode { get; set; }

        [MaxLength(200)]
        public string? ProductName { get; set; }

        // Depósito de destino (para ITEM)
        public int? WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; } = 1m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountPercent { get; set; } = 0m;

        public int? TaxId { get; set; }
        public Tax? Tax { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal TaxRate { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal SubTotal { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxAmount { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; } = 0m;

        // Lote / serie (para ITEM loteable/serializable)
        [MaxLength(100)]
        public string? BatchNumber { get; set; }

        public DateTime? ExpirationDate { get; set; }

        public string? SerialNumbers { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
