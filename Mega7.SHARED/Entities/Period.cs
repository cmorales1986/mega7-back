using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{

    public class Period
    {
        public int Id { get; set; }

        public int Year { get; set; }          // 2025
        public int Month { get; set; }         // 1..12

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public bool IsOpen { get; set; }       // true = abierto
        public bool IsActive { get; set; }     // soft delete

        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
    }
}
