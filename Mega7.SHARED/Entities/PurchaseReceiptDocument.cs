using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class PurchaseReceiptDocument
    {
        public int Id { get; set; }

        public int PurchaseReceiptId { get; set; }
        public PurchaseReceipt? PurchaseReceipt { get; set; }

        // "INVOICE" | "DELIVERY_NOTE"
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Number { get; set; } = string.Empty;

        public DateTime? Date { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
