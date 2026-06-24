using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SerialPickDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }

        public int WarehouseId { get; set; }
        public string WarehouseName { get; set; } = "";

        public string SerialNumber { get; set; } = "";
        public bool IsActive { get; set; }
    }
}
