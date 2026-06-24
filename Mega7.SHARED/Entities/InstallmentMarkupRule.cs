using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class InstallmentMarkupRule
    {
        public int Id { get; set; }

        public int? CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        public int MinInstallments { get; set; }
        public int MaxInstallments { get; set; } // inclusive

        // Opcional: si querés diferenciar por intervalo (7/15/30 días)
        public int? IntervalDays { get; set; } // null = cualquiera

        public decimal MarkupPct { get; set; } // sobre costo

        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; } = 0;
    }
}
