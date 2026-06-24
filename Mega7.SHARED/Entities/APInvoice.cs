using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class APInvoice
    {
        public int Id { get; set; }

        // Relación 1-1 con la recepción
        public int? PurchaseReceiptId { get; set; }
        public PurchaseReceipt? PurchaseReceipt { get; set; }

        // Snapshot proveedor
        public int SupplierId { get; set; }

        [MaxLength(200)]
        public string SupplierName { get; set; } = string.Empty;

        // Datos factura proveedor
        [MaxLength(50)]
        public string InvoiceNumber { get; set; } = string.Empty;

        public DateTime InvoiceDate { get; set; } = DateTime.UtcNow.Date;

        public DateTime? DueDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        public int SocioNegocioId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; }

        // OPEN | PARTIAL | PAID | CANCELLED
        [MaxLength(20)]
        public string Status { get; set; } = "OPEN";

        // Auditoría
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Opcional (para futuro)
        public DateTime? PaidAt { get; set; }
        public DateTime? CancelledAt { get; set; }
        [MaxLength(500)]
        public string? CancelReason { get; set; }

        public decimal ReceiptTotalAtLink { get; set; }
        public decimal DiffAtLink { get; set; }
        public DateTime? LinkedAt { get; set; }

        [MaxLength(20)]
        public string SourceType { get; set; } = "GOODS"; // GOODS | SERVICE

        public string Notes { get; set; } = string.Empty;

        public List<APInvoicePayment> Payments { get; set; } = new();
        public List<APInvoiceInstallment> Installments { get; set; } = new();

    }
}
