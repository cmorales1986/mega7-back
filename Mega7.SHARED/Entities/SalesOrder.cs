using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class SalesOrder
    {
        public int Id { get; set; }

        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty; // OV000001 (Orden de Venta)

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        // Cliente
        public int CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty; // snapshot

        // Depósito origen (referencia para futura salida/facturación)
        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "DRAFT"; // DRAFT, OPEN, CLOSED, CANCELED

        [MaxLength(500)]
        public string? Comments { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        public decimal DocumentDiscountPercent { get; set; } = 0m;
        public decimal DocumentDiscountAmount { get; set; } = 0m;

        public List<SalesOrderLine> Lines { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
