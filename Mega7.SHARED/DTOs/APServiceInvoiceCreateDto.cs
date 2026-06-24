using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Mega7.SHARED.DTOs
{
    public class APServiceInvoiceLineDto
    {
        [Required, MaxLength(200)]
        public string Description { get; set; } = string.Empty;

        public decimal Quantity { get; set; } = 1m;
        public decimal UnitPrice { get; set; } = 0m;
    }

    public class APServiceInvoiceCreateDto
    {
        [Range(1, int.MaxValue)]
        public int SupplierId { get; set; }

        [Required, MaxLength(50)]
        public string InvoiceNumber { get; set; } = string.Empty;

        public DateTime InvoiceDate { get; set; } = DateTime.UtcNow.Date;
        public DateTime? DueDate { get; set; }

        // Total manual (solo si NO hay líneas)
        public decimal Total { get; set; }

        [MaxLength(250)]
        public string? Notes { get; set; }

        public List<APServiceInvoiceLineDto>? Lines { get; set; }
    }
}
