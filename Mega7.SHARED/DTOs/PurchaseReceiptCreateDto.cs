using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class PurchaseReceiptCreateDto
    {
        public int PurchaseOrderId { get; set; }
        public DateTime ReceiptDate { get; set; }
        public string? Comments { get; set; }
        public List<PurchaseReceiptLineCreateDto> Lines { get; set; } = new();
        public List<PurchaseReceiptDocumentCreateDto>? Documents { get; set; }
    }
}
