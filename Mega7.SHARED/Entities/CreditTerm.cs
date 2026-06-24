using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class CreditTerm
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;   // "Contado", "30 días", etc.
        public int Days { get; set; }               // 0, 7, 15, 30, 60, 90...
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
