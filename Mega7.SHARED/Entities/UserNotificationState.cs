using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class UserNotificationState
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        // clave estable de la alerta (ej: "cashbox_open", "invoices_overdue")
        public string Key { get; set; } = null!;

        public DateTime? LastSeenAt { get; set; }
        public DateTime? DismissedUntil { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
