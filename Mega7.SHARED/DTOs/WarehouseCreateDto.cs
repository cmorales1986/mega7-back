using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class WarehouseCreateDto
    {
        public string Code { get; set; } = null!;   // Ej: PER01
        public string Name { get; set; } = null!;   // Nombre del almacén
        public string? Address { get; set; }        // Opcional
        public string? Phone { get; set; }          // Opcional
        public bool IsActive { get; set; } = true;
    }
}
