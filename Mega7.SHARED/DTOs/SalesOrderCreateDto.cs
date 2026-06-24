using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SalesOrderCreateDto
    {
        public DateTime OrderDate { get; set; }
        public int CustomerId { get; set; }
        public int WarehouseId { get; set; }
        public string? Comments { get; set; }

        public decimal DocumentDiscountPercent { get; set; } = 0m;
        public decimal DocumentDiscountAmount { get; set; } = 0m;    // Gs
        public List<SalesOrderLineCreateDto> Lines { get; set; } = new();
    }
}
