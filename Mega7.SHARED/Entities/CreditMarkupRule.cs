using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class CreditMarkupRule
    {
        public int Id { get; set; }

        public int? CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        public int MinDays { get; set; }
        public int MaxDays { get; set; }  // inclusive

        public decimal MarkupPct { get; set; } // sobre costo

        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; } = 0; // por si querés ordenar manualmente
    }
}
