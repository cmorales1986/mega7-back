using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class StockEntryLine
    {
        public int Id { get; set; }

        public int StockEntryId { get; set; }
        public StockEntry? StockEntry { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        // Cantidad que entra
        public decimal Quantity { get; set; }

        // Costo por unidad en este ingreso
        public decimal UnitCost { get; set; }

        // Impuesto aplicado (del producto)
        public decimal TaxRate { get; set; }

        // Afectación a lote
        public string? BatchNumber { get; set; }
        public DateTime? ExpirationDate { get; set; }

        // Seriales (si es serializable)
        public string? SerialNumbers { get; set; } // CSV: “SN1,SN2,SN3”

        // Depósito (por si cambia para cada línea)
        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }
    }
}
