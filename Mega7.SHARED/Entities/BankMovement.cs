using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    // IN  = entrada (aumenta)
    // OUT = salida (disminuye)
    // TRANSFER = transferencia entre cuentas
    public class BankMovement
    {
        public int Id { get; set; }

        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string Type { get; set; } = "IN"; // IN | OUT | TRANSFER

        // Para IN/OUT se usa AccountId
        public int? AccountId { get; set; }
        public BankAccount? Account { get; set; }

        // Para TRANSFER se usan FromAccountId y ToAccountId
        public int? FromAccountId { get; set; }
        public BankAccount? FromAccount { get; set; }

        public int? ToAccountId { get; set; }
        public BankAccount? ToAccount { get; set; }

        public decimal Amount { get; set; } = 0m; // siempre positivo
        public string Currency { get; set; } = "PYG"; // por consistencia/reportes

        public string Description { get; set; } = "";
        public string Reference { get; set; } = ""; // nro comprobante, etc.

        public bool IsCancelled { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
