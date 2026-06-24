using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseReceiptUpsertDocDto
    {
        // "INVOICE" | "DELIVERY_NOTE"
        public string Type { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
    }
}
