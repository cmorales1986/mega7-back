using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class BankAccount
    {
        public int Id { get; set; }

        public int BankId { get; set; }
        public Bank? Bank { get; set; }

        public string AccountNumber { get; set; } = ""; // nro cuenta / CBU / etc.
        public string Alias { get; set; } = "";         // nombre corto interno
        public string Currency { get; set; } = "PYG";    // "PYG", "USD", etc.

        public decimal InitialBalance { get; set; } = 0m;
        public DateTime InitialBalanceDate { get; set; } = DateTime.UtcNow.Date;

        // Cuenta contable asociada (ej: "Banco - Cuenta Corriente")
        public int? AccountId { get; set; }
        public Account? Account { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
