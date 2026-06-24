using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class APInvoicePayDto
    {
        public DateTime? PaymentDate { get; set; }
        public decimal Amount { get; set; }
        public string? Method { get; set; }
        public string? Reference { get; set; }
        public string? Notes { get; set; }

        // ✅ NUEVO: opción B (cuota específica)
        public int? InstallmentId { get; set; }              // si null => automático
        public bool ApplyExcessToNext { get; set; } = true;  // si paga más que esa cuota, distribuir a siguientes
    }
}
