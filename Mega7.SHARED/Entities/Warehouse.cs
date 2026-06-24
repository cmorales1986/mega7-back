using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Warehouse
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;     // Ej: "DP01", "TIENDA01"
        public string Name { get; set; } = null!;     // Ej: Deposito Central
        public string Address { get; set; } = "";     // Opcional
        public string Phone { get; set; } = "";       // Opcional
        public bool IsActive { get; set; } = true;
    }
}
