using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Batch
    {
        public int Id { get; set; }

        // Número único del lote (requerido)
        public string BatchNumber { get; set; } = null!;

        // Opcional pero útil (para productos que vencen)
        public DateTime? ExpirationDate { get; set; }

        // Relación con producto loteable
        public int ProductId { get; set; }
        public Product? Product { get; set; }

        // Depósito en el cual existe este lote
        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        // Cantidad disponible en este lote
        public decimal Quantity { get; set; } = 0m;

        // Para habilitar o deshabilitar lote
        public bool IsActive { get; set; } = true;

        public decimal UnitCost { get; set; } = 0m; // ✅ NUEVO


        // Fecha de creación (trazabilidad)
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Fecha del último movimiento
        public DateTime? UpdatedAt { get; set; }
    }
}
