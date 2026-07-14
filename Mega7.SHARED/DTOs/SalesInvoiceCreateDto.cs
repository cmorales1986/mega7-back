using System;
using System.Collections.Generic;

namespace Mega7.SHARED.DTOs
{
    public class UpdateCommentsDto
    {
        public string? Comments { get; set; }
    }

    public class SalesInvoiceCreateDto
    {
        // null = modo directo (sin OV)
        public int? SalesOrderId { get; set; }

        // Vincular a una Entrega existente (los datos de líneas y stock vienen de ella)
        public int? SalesDeliveryId { get; set; }

        // Modo directo: requeridos cuando SalesOrderId es null
        public int? CustomerId    { get; set; }
        public int? WarehouseId   { get; set; }
        public List<SalesInvoiceDirectLineDto>? DirectLines { get; set; }

        public DateTime InvoiceDate { get; set; }

        // CASH / CREDIT
        public string PaymentType { get; set; } = "CASH";

        // Si CREDIT y CreditInstallments=true => usar N (>=2)
        public int? InstallmentsCount { get; set; }

        public string? Comments { get; set; }
        public string? ExternalNumber { get; set; }

        // ===== NUEVO: decisión por factura (NO por cliente) =====
        public bool CreditInstallments { get; set; } = false;

        // opcional: si viene, pisa el del cliente (snapshot)
        public int? CreditTermId { get; set; }

        // días editable por factura (override del CreditTerm.Days)
        public int CreditDays { get; set; } = 0;

        // para cuotas (si viene null => se calcula por invoiceDate+creditDays)
        public DateTime? FirstDueDate { get; set; }

        // para cuotas (si viene 0 => default 30)
        public int IntervalDays { get; set; } = 30;

        // ===== NUEVO: esquema de cuotas =====
        // "INTERVAL" | "DAY_OF_MONTH" (si null => default INTERVAL para no romper)
        public string? InstallmentScheduleType { get; set; }

        // Solo si DAY_OF_MONTH
        public int? DueDayOfMonth { get; set; } // 1..31

        // Opcional: "AUTO" | "NEXT_MONTH"
        public string? FirstDueRule { get; set; }

        public int? FiscalSeriesId { get; set; }

        // si null → factura todo lo pendiente
        public List<SalesInvoiceLineDto>? Lines { get; set; }
    }
}
