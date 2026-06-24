using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Mega7.SHARED.Entities
{
    public class ARSalesReceipt
    {
        public int Id { get; set; }

        [MaxLength(20)]
        public string DocNumber { get; set; } = string.Empty; // RB000001 (interno opcional)

        public DateTime ReceiptDate { get; set; } = DateTime.UtcNow;

        // Cliente snapshot
        public int CustomerId { get; set; }

        [MaxLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? CustomerRuc { get; set; }

        // Medio de cobro (del recibo)
        [MaxLength(30)]
        public string PaymentMethod { get; set; } = "CASH"; // CASH|TRANSFER|CARD|CHECK|OTHER

        [MaxLength(100)]
        public string? PaymentReference { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalReceived { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        // ===== Fiscal RECIBO =====
        [MaxLength(30)]
        public string FiscalDocType { get; set; } = "RECIBO";

        [MaxLength(30)]
        public string? FiscalTimbrado { get; set; }

        [MaxLength(10)]
        public string? FiscalEstablishment { get; set; }

        [MaxLength(10)]
        public string? FiscalExpeditionPoint { get; set; }

        public int? FiscalNumber { get; set; }

        [MaxLength(30)]
        public string? FiscalFullNumber { get; set; } // 001-001-0000123

        public int? FiscalSeriesId { get; set; }
        public FiscalDocumentSeries? FiscalSeries { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsDeposited { get; set; } = false;

        public DateTime? DepositedAt { get; set; }

        public int? DepositedByUserId { get; set; }

        public int? BankMovementId { get; set; }

        public List<ARSalesReceiptLine> Lines { get; set; } = new();
        public List<ARInvoicePayment> Payments { get; set; } = new(); // opcional (por link desde ARInvoicePayment)
    }
}
