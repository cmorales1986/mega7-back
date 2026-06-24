using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class ARInvoiceInstallment
    {
        public int Id { get; set; }

        public int ARInvoiceId { get; set; }
        public ARInvoice? ARInvoice { get; set; }

        public int Number { get; set; } // 1..N
        public DateTime DueDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PaidAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; }

        public bool IsPaid { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow; // ✅ faltante
        public DateTime? UpdatedAt { get; set; }                  // ✅ faltante
    }
}
