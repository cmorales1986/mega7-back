using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class UpdatePurchaseReceiptLinePriceDto
    {
        public int LineId { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscountPercent { get; set; } // 0..100
        public int? TaxId { get; set; }
    }
}
