using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class APInvoiceCancelPaymentDto
    {
        public string? Reason { get; set; }
        public int? CancelledByUserId { get; set; }
    }
}
