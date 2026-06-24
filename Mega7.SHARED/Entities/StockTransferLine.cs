namespace Mega7.SHARED.Entities
{
    public class StockTransferLine
    {
        public int Id { get; set; }

        public int StockTransferId { get; set; }
        public StockTransfer? StockTransfer { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public decimal Quantity { get; set; }

        // Lote (si corresponde)
        public string? BatchNumber { get; set; }

        // Seriales (si corresponde)
        public string? SerialNumbers { get; set; } // CSV: SN1,SN2,SN3

        public decimal UnitCostMoved { get; set; } = 0m; // ✅ NUEVO
        public decimal LineCost { get; set; } = 0m;      // ✅ NUEVO


        public int FromWarehouseId { get; set; }
        public int ToWarehouseId { get; set; }
    }
}
