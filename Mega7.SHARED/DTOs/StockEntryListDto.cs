using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class StockEntryListDto
    {
        public int Id { get; set; }
        public DateTime EntryDate { get; set; }
        public string DocumentType { get; set; } = "";
        public string DocumentNumber { get; set; } = "";
        public string EntryMode { get; set; } = "";
        public string? SupplierName { get; set; }
        public string? DocumentRef { get; set; }

        public int WarehouseId { get; set; }
        public string WarehouseName { get; set; } = "";

        public int LinesCount { get; set; }
        public decimal QtyTotal { get; set; }
        public decimal Total { get; set; }
    }
}
