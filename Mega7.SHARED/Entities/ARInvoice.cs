using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class ARInvoice
    {
        public int Id { get; set; }

        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty; // FV000001 (Factura Venta)

        public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;

        // Cliente
        public int CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        // Referencia OV
        public int? SalesOrderId { get; set; }
        public SalesOrder? SalesOrder { get; set; }

        // Referencia Entrega (null = factura directa o sin entrega previa)
        public int? SalesDeliveryId { get; set; }
        public SalesDelivery? SalesDelivery { get; set; }

        // Depósito
        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "OPEN"; // OPEN, PARTIAL, PAID, CANCELLED

        [MaxLength(20)]
        public string PaymentType { get; set; } = "CASH"; // CASH, CREDIT

        public int? InstallmentsCount { get; set; } // si CREDIT

        public int? CreditTermId { get; set; } // snapshot / default
        public CreditTerm? CreditTerm { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SubTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxTotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PaidAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; }

        public DateTime? DueDate { get; set; }

        [MaxLength(500)]
        public string? Comments { get; set; }

        public List<ARInvoiceLine> Lines { get; set; } = new();
        public List<ARInvoiceInstallment> Installments { get; set; } = new();
        public List<ARInvoicePayment> Payments { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? CancelledAt { get; set; }

        public DateTime? PaidAt { get; set; }

        // ===== Esquema de cuotas (metadata del patrón) =====
        // INTERVAL | DAY_OF_MONTH (null = legacy)
        [MaxLength(20)]
        public string? InstallmentScheduleType { get; set; }

        // Solo si InstallmentScheduleType == "INTERVAL"
        public int? IntervalDays { get; set; }

        // Solo si InstallmentScheduleType == "DAY_OF_MONTH" (1..31)
        public int? DueDayOfMonth { get; set; }

        // Opcional: “ancla” de primera cuota (si el usuario la define)
        public DateTime? FirstDueDate { get; set; }

        // AUTO | NEXT_MONTH (opcional)
        [MaxLength(30)]
        public string? FirstDueRule { get; set; }

        // ===== Datos fiscales emitidos =====
        [MaxLength(30)]
        public string? FiscalDocType { get; set; } // "FACTURA"

        [MaxLength(30)]
        public string? FiscalTimbrado { get; set; }

        [MaxLength(10)]
        public string? FiscalEstablishment { get; set; }

        [MaxLength(10)]
        public string? FiscalExpeditionPoint { get; set; }

        public int? FiscalNumber { get; set; } // 1..N dentro del rango

        [MaxLength(30)]
        public string? FiscalFullNumber { get; set; } // "001-001-0000123"

        public string? CancelReason { get; set; }   // ✅ faltante

        public int? FiscalSeriesId { get; set; }
        public FiscalDocumentSeries? FiscalSeries { get; set; }

        [MaxLength(50)]
        public string? ExternalNumber { get; set; }
    }
}
