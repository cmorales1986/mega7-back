using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class BatchPickDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }

        public int WarehouseId { get; set; }
        public string WarehouseName { get; set; } = "";

        public string BatchNumber { get; set; } = "";
        public decimal Quantity { get; set; }

        public DateTime? ExpirationDate { get; set; }
    }
}
