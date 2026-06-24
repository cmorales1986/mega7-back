using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class StockOutputListDto
    {
        public int Id { get; set; }

        public DateTime? OutputDate { get; set; }

        public string DocumentType { get; set; } = "";
        public string DocumentNumber { get; set; } = "";

        public int WarehouseId { get; set; }
        public string WarehouseName { get; set; } = "";

        public int LinesCount { get; set; }
        public decimal QtyTotal { get; set; }
    }
}
