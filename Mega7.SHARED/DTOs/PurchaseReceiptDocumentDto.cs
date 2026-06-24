using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseReceiptDocumentDto
    {
        public string Type { get; set; } = "";          // "DELIVERY_NOTE" | "INVOICE"
        public string Number { get; set; } = "";        // requerido si el doc existe
        public DateTime? Date { get; set; }
    }
}
