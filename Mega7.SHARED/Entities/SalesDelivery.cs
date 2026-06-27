using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class SalesDelivery
    {
        public int Id { get; set; }

        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty; // EV000001

        public DateTime DeliveryDate { get; set; } = DateTime.UtcNow;

        // Relación con OV (null = entrega directa sin OV)
        public int? SalesOrderId { get; set; }
        public SalesOrder? SalesOrder { get; set; }

        // Snapshots
        public int CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "POSTED"; // POSTED / CANCELLED

        [MaxLength(500)]
        public string? Comments { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        public List<SalesDeliveryLine> Lines { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public bool IsCancelled { get; set; }
        public DateTime? CancelledAt { get; set; }

        [MaxLength(500)]
        public string? CancelReason { get; set; }

        public bool IsInvoiced { get; set; } = false;
        public DateTime? InvoicedAt { get; set; }

        public ARInvoice? ARInvoice { get; set; }
    }
}
