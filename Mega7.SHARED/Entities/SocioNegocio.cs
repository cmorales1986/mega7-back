namespace Mega7.SHARED.Entities
{
    public class SocioNegocio
    {
        public int Id { get; set; }

        // Tipo: C = Cliente, S = Proveedor, A = Ambos (opcional)
        public string PartnerType { get; set; } = "C";

        // Identificación
        public string Code { get; set; } = null!;        // Código interno
        public string RazonSocial { get; set; } = null!;
        public string RUC { get; set; } = null!;

        // Contacto
        public string? Contacto { get; set; }
        public string? Telefono { get; set; }
        public string? Email { get; set; }

        // Dirección principal
        public string? Direccion { get; set; }
        public string? Ciudad { get; set; }

        // Datos adicionales
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Crédito / Condiciones
        public int? CreditTermId { get; set; }
        public CreditTerm? CreditTerm { get; set; }

        public decimal? CreditLimit { get; set; } // opcional

        public bool AllowInstallments { get; set; } = false;
        public int? MaxInstallments { get; set; }          // ej 12
        public int? DefaultInstallments { get; set; }

        public bool AllowCredit { get; set; } = true;

        // Relación con sucursales
        public ICollection<SocioNegocioSucursal>? Sucursales { get; set; }
    }
}
