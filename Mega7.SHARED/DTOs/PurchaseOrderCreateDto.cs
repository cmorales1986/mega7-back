using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseOrderCreateDto
    {
        public DateTime OrderDate { get; set; }
        public int SupplierId { get; set; }
        public int WarehouseId { get; set; }
        public string? Comments { get; set; }
        public List<PurchaseOrderLineCreateDto> Lines { get; set; } = new();
    }
}
