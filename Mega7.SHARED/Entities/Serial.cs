using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Serial
    {
        public int Id { get; set; }
        public string SerialNumber { get; set; } = null!;

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        // Siempre 1 unidad por número de serie
        public bool IsActive { get; set; } = true;

        public decimal UnitCost { get; set; } = 0m; // ✅ NUEVO


        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
