namespace Mega7.SHARED.Entities
{
    public class StockOutput
    {
        public int Id { get; set; }

        public string DocumentType { get; set; } = "SALIDA"; // Venta / Consumo / Ajuste
        public string DocumentNumber { get; set; } = ""; // opcional

        public DateTime OutputDate { get; set; } = DateTime.UtcNow;

        // Cliente (opcional si es consumo interno)
        public int? SocioNegocioId { get; set; }
        public SocioNegocio? SocioNegocio { get; set; }

        // Depósito
        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        // Datos adicionales
        public string? Notes { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<StockOutputLine>? Lines { get; set; }
    }
}
