using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class CashMovement
    {
        public int Id { get; set; }

        public DateTime Date { get; set; } = DateTime.UtcNow;

        // IN | OUT | TRANSFER
        public string Type { get; set; } = "IN";

        // PYG only
        public string Currency { get; set; } = "PYG";

        // IN/OUT
        public int? CashBoxId { get; set; }
        public CashBox? CashBox { get; set; }

        // TRANSFER
        public int? FromCashBoxId { get; set; }
        public CashBox? FromCashBox { get; set; }
        public int? ToCashBoxId { get; set; }
        public CashBox? ToCashBox { get; set; }

        public decimal Amount { get; set; } = 0m;

        public int? CategoryId { get; set; }
        public CashCategory? Category { get; set; }

        public string Description { get; set; } = "";
        public string Reference { get; set; } = "";

        public bool IsCancelled { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CancelledAt { get; set; }
        public string CancelReason { get; set; } = "";
    }
}
