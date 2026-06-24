using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class CashBox
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public ICollection<CashSession> Sessions { get; set; } = new List<CashSession>();

        // ✅ Separadas para que EF no se confunda
        public ICollection<CashMovement> Movements { get; set; } = new List<CashMovement>();           // IN/OUT
        public ICollection<CashMovement> TransfersOut { get; set; } = new List<CashMovement>();       // TRANSFER (From)
        public ICollection<CashMovement> TransfersIn { get; set; } = new List<CashMovement>();        // TRANSFER (To)
    }
}
