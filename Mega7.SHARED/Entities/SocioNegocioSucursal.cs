namespace Mega7.SHARED.Entities
{
    public class SocioNegocioSucursal
    {
        public int Id { get; set; }

        public int SocioNegocioId { get; set; }
        public SocioNegocio? SocioNegocio { get; set; }

        public string Nombre { get; set; } = null!;
        public string? Direccion { get; set; }
        public string? Ciudad { get; set; }
        public string? Telefono { get; set; }
        public string? Contacto { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
