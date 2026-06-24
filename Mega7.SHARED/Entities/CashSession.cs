using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class CashSession
    {
        public int Id { get; set; }
        public int CashBoxId { get; set; }
        public CashBox? CashBox { get; set; }

        // Día operativo
        public DateTime Date { get; set; } // Date-only (guardá .Date)

        // Apertura
        public decimal OpeningBalance { get; set; } = 0m;
        public DateTime OpenedAt { get; set; } = DateTime.UtcNow;

        // Cierre
        public bool IsClosed { get; set; } = false;
        public decimal? CountedCash { get; set; } // lo contado en físico al cierre
        public decimal? ClosingBalanceSystem { get; set; } // saldo según sistema
        public decimal? Difference { get; set; } // contado - sistema
        public DateTime? ClosedAt { get; set; }
        public string CloseNotes { get; set; } = "";
    }
}
