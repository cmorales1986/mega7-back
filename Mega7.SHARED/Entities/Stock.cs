using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Stock
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        public decimal Quantity { get; set; } = 0;

        // ✅ NUEVO: promedio ponderado móvil por depósito
        public decimal AvgCost { get; set; } = 0m;
    }
}
