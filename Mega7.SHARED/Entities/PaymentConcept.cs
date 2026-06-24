using System;
using System.ComponentModel.DataAnnotations;

namespace Mega7.SHARED.Entities
{
    public class PaymentConcept
    {
        public int Id { get; set; }

        // Ej: SUELDOS, IPS, IMPUESTOS, OTRO
        [MaxLength(30)]
        public string Code { get; set; } = string.Empty;

        // Texto visible
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        // Si querés, para que "Otro" sea el default
        public bool IsDefault { get; set; } = false;

        // Si querés que ciertos conceptos pidan proveedor (ej: Honorarios)
        public bool RequiresBusinessPartner { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
