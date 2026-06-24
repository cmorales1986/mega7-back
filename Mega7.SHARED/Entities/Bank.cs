using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Bank
    {
        public int Id { get; set; }
        public string Code { get; set; } = "";      // opcional (ej: "ITAU", "BBVA")
        public string Name { get; set; } = "";
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public List<BankAccount> Accounts { get; set; } = new();
    }
}
