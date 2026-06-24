using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PeriodUpdateDto
    {
        public int Year { get; set; }
        public int Month { get; set; }

        // Opcionales: podés actualizar flags sin tocar fechas
        public bool? IsOpen { get; set; }
        public bool? IsActive { get; set; }

        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
