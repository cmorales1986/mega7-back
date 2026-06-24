namespace Mega7.SHARED.Entities
{
    public class StockTransfer
    {
        public int Id { get; set; }

        public DateTime TransferDate { get; set; } = DateTime.UtcNow;

        public int FromWarehouseId { get; set; }
        public Warehouse? FromWarehouse { get; set; }

        public int ToWarehouseId { get; set; }
        public Warehouse? ToWarehouse { get; set; }

        public string? Notes { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<StockTransferLine>? Lines { get; set; }
    }
}
