using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SalesInvoiceLineDto
    {
        public int SalesOrderLineId { get; set; }
        public decimal Quantity { get; set; }

        public string? BatchNumber { get; set; }
        public string? SerialNumbers { get; set; }
    }
}
