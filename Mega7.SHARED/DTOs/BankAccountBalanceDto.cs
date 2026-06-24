using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class BankAccountBalanceDto
    {
        public int AccountId { get; set; }
        public int BankId { get; set; }
        public string BankName { get; set; } = "";
        public string Alias { get; set; } = "";
        public string Currency { get; set; } = "PYG";
        public decimal InitialBalance { get; set; }
        public decimal MovementsNet { get; set; }
        public decimal CurrentBalance { get; set; }
        public DateTime AsOf { get; set; }
        public bool IsActive { get; set; }
    }
}
