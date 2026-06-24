using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class LateFeeRule
    {
        public int Id { get; set; }

        public int? CustomerId { get; set; }
        public SocioNegocio? Customer { get; set; }

        public int MinDaysLate { get; set; }
        public int MaxDaysLate { get; set; } // inclusive

        public decimal PctPerDay { get; set; } // % por día en ese tramo

        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; } = 0;
    }
}
