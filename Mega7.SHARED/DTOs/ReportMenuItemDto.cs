using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class ReportMenuItemDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = "";
        public bool Titulo { get; set; }
        public string? Color { get; set; }
        public string? Icono { get; set; }
        public string? Url { get; set; }
        public int? IdPadre { get; set; }
        public int Orden { get; set; }
        public string? Role { get; set; } // ✅

        public List<ReportMenuItemDto> Children { get; set; } = new();
    }

}
