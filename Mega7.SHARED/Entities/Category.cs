using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Category
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public bool IsActive { get; set; } = true;

        // ── Determinación de cuentas contables ────────────────────────────────
        /// <summary>Cuenta de ingresos por ventas (ej: Ventas Gravadas)</summary>
        public int? RevenueAccountId { get; set; }
        public Account? RevenueAccount { get; set; }

        /// <summary>Cuenta de costo de ventas (ej: CMV)</summary>
        public int? CogsAccountId { get; set; }
        public Account? CogsAccount { get; set; }

        /// <summary>Cuenta de inventario / existencias (ej: Mercaderías)</summary>
        public int? InventoryAccountId { get; set; }
        public Account? InventoryAccount { get; set; }

        /// <summary>Cuenta de gasto o activo en compras (ej: Compras, Gastos generales)</summary>
        public int? PurchaseAccountId { get; set; }
        public Account? PurchaseAccount { get; set; }
    }
}
