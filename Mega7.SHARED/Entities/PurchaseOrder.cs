using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class PurchaseOrder
    {
        public int Id { get; set; }

        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty; // OC000001

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        // Proveedor
        public int SupplierId { get; set; }
        public SocioNegocio? Supplier { get; set; }

        [MaxLength(200)]
        public string SupplierName { get; set; } = string.Empty; // snapshot

        // Depósito destino (referencia para futura recepción)
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

        public List<PurchaseOrderLine> Lines { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
