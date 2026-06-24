using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class UpdatePurchaseReceiptDocumentsRequest
    {
        public List<PurchaseReceiptDocumentDto> Documents { get; set; } = new();
    }
}
