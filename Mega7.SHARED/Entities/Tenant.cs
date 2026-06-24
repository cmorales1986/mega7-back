using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Tenant
    {
        public int Id { get; set; }

        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(50)]
        public string RUC { get; set; } = string.Empty;

        [MaxLength(250)]
        public string Address { get; set; } = string.Empty;

        [MaxLength(120)]
        public string Email { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Phone { get; set; } = string.Empty;

        // --- FUTURO (multiempresa/branding) ---
        [MaxLength(500)]
        public string? LogoUrl { get; set; }

        [MaxLength(20)]
        public string? PrimaryColor { get; set; } // ej: "#16a34a"

        [MaxLength(20)]
        public string? SecondaryColor { get; set; } // ej: "#0ea5e9"

        public bool IsActive { get; set; } = true;
    }
}
