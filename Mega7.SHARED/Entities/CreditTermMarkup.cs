using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class CreditTermMarkup
    {
        public int Id { get; set; }

        // null = global, != null = override por cliente
        public int? CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        public int CreditTermId { get; set; }
        public CreditTerm CreditTerm { get; set; } = null!;

        public decimal MarkupPct { get; set; } // % sobre costo
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
