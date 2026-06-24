using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class UnitOfMeasureCreateDto
    {
        public string Code { get; set; } = null!;  // "UN", "KG", "MTS"
        public string Name { get; set; } = null!;  // Unidad, Kilogramo, Metros
        public bool IsActive { get; set; } = true;
    }
}
