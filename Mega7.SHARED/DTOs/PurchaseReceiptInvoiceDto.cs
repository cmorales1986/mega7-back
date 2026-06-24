using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseReceiptInvoiceDto
    {
        [Required]
        [MaxLength(50)]
        public string InvoiceNumber { get; set; } = string.Empty;

        public DateTime? InvoiceDate { get; set; }
        public DateTime? InvoiceDueDate { get; set; }

        public decimal? InvoiceTotal { get; set; }

        // opcional: si querés también crear/actualizar el documento asociado "INVOICE"
        public bool UpsertInvoiceDocument { get; set; } = true;

        public bool IsCredit { get; set; }              // contado/credito
        public int? CreditTermId { get; set; }          // opcional  // ya existe
        public int? Installments { get; set; }          // null/0 o >=2
    }
}
