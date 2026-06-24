using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class APInvoiceInstallment
    {
        public int Id { get; set; }

        public int APInvoiceId { get; set; }
        public APInvoice? APInvoice { get; set; }

        public int InstallmentNo { get; set; } // 1..N

        public DateTime DueDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }   // Monto de la cuota

        [Column(TypeName = "decimal(18,2)")]
        public decimal PaidAmount { get; set; } // Pagado acumulado

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; }  // Saldo = Amount - PaidAmount

        [MaxLength(20)]
        public string Status { get; set; } = "OPEN"; // OPEN | PAID

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
