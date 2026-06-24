namespace Mega7.SHARED.Entities
{
    public class StockOutputLine
    {
        public int Id { get; set; }

        public int StockOutputId { get; set; }
        public StockOutput? StockOutput { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public decimal Quantity { get; set; }

        // Lote (si corresponde)
        public string? BatchNumber { get; set; }

        // Seriales (si corresponde)
        public string? SerialNumbers { get; set; } // CSV: "SN1,SN2"

        public decimal UnitCostApplied { get; set; } = 0m; // ✅ NUEVO
        public decimal LineCost { get; set; } = 0m;        // ✅ NUEVO


        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }
    }
}
