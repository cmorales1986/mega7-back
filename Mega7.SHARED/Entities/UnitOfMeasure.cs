using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class UnitOfMeasure
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!; // Ej: "UN", "KG", "MTS"
        public string Name { get; set; } = null!; // Ej: Unidad, Kilogramo, Metros
        public bool IsActive { get; set; } = true;
    }
}
