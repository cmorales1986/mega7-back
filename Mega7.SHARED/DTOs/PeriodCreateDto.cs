using Mega7.SHARED.DTOs;
using System.ComponentModel.DataAnnotations;

namespace Mega7.SHARED.DTOs
{
    public class PeriodCreateDto
    {
        [Range(2000, 2100)]
        public int Year { get; set; }

        [Range(1, 12)]
        public int Month { get; set; }

        [Required]
        public DateTime StartDate { get; set; } // en UTC o local, según tu estándar

        [Required]
        public DateTime EndDate { get; set; }

        // normalmente: al crear queda abierto y activo (pero lo dejamos configurable)
        public bool IsOpen { get; set; } = true;
        public bool IsActive { get; set; } = true;
    }
}