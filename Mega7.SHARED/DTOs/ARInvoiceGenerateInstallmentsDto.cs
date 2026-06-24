using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class ARInvoiceGenerateInstallmentsDto
    {
        public int Count { get; set; } = 1;
        public int CreditDays { get; set; } = 0;

        public string? InstallmentScheduleType { get; set; } // INTERVAL | DAY_OF_MONTH
        public int? IntervalDays { get; set; }              // si INTERVAL
        public int? DueDayOfMonth { get; set; }             // si DAY_OF_MONTH
        public DateTime? FirstDueDate { get; set; }         // opcional
        public string? FirstDueRule { get; set; }           // AUTO | NEXT_MONTH
    }

}
