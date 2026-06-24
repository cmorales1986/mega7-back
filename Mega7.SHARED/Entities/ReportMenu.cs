using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class ReportMenu
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = "";
        public bool Titulo { get; set; } = false;
        public string? Color { get; set; }
        public string? Icono { get; set; }
        public string? Url { get; set; }
        public int? IdPadre { get; set; }
        public int Orden { get; set; } = 0;
        public bool IsActive { get; set; } = true;

        public string? Role { get; set; } // ✅ NULL/""/"ALL" => visible para todos
    }
}
