using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class PurchaseReceipt
    {
        public int Id { get; set; }

        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty; // RC000001

        public DateTime ReceiptDate { get; set; } = DateTime.UtcNow;

        // Relación con Orden de Compra
        public int PurchaseOrderId { get; set; }
        public PurchaseOrder? PurchaseOrder { get; set; }

        // Snapshots
        public int SupplierId { get; set; }
        public SocioNegocio? Supplier { get; set; }

        [MaxLength(200)]
        public string SupplierName { get; set; } = string.Empty;

        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "POSTED"; // POSTED (por ahora)

        [MaxLength(500)]
        public string? Comments { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        public List<PurchaseReceiptLine> Lines { get; set; } = new();

        public List<PurchaseReceiptDocument> Documents { get; set; } = new();


        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsCancelled { get; set; }
        public DateTime? CancelledAt { get; set; }
        public string? CancelReason { get; set; }
        public int? CancelledByUserId { get; set; }

        public DateTime? UpdatedAt { get; set; }
        public string? CancelledBy { get; set; }

        public bool IsInvoiced { get; set; } = false;

        public DateTime? InvoicedAt { get; set; }

        [MaxLength(50)]
        public string? InvoiceNumber { get; set; }

        public DateTime? InvoiceDate { get; set; }

        public DateTime? InvoiceDueDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? InvoiceTotal { get; set; }
        public APInvoice? APInvoice { get; set; }

        public bool? InvoiceIsCredit { get; set; }           // null = usar default proveedor
        public int? InvoiceCreditTermId { get; set; }        // null = usar term proveedor
        public int? InvoiceInstallments { get; set; }        // null/0/1 = sin cuotas; >=2 = cuotas

        public CreditTerm? InvoiceCreditTerm { get; set; }   // (opcional) navegación


    }
}
