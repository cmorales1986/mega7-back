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

        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; } = 1m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal LineTotal { get; set; } = 0m;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
