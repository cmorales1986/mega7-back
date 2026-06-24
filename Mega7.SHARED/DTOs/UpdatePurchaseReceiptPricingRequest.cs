using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class UpdatePurchaseReceiptPricingRequest
    {
        public List<UpdatePurchaseReceiptLinePriceDto> Lines { get; set; } = new();
    }
}
