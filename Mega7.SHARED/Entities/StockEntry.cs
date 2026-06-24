using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class StockEntry
    {
        public int Id { get; set; }

        public string DocumentType { get; set; } = null!;  // "FACTURA", "REMISION"
        public string DocumentNumber { get; set; } = null!;
        public DateTime EntryDate { get; set; } = DateTime.UtcNow;

        public int WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        public string? SupplierName { get; set; } // opcional
        public string? Notes { get; set; }

        public string EntryMode { get; set; } = "ADD"; // "ADD" | "SET"
        public int? SupplierId { get; set; }
        public string? DocumentRef { get; set; }


        public string CreatedBy { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<StockEntryLine>? Lines { get; set; }
    }
}
