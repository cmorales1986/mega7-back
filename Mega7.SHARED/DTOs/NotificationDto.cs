namespace Mega7.API.DTOs
{
    public class NotificationDto
    {
        public string Key { get; set; } = null!;         // "cashbox_open"
        public string Title { get; set; } = null!;       // "Cajas abiertas"
        public string Message { get; set; } = null!;     // "Hay 2 cajas sin cerrar"
        public string Severity { get; set; } = "info";   // "critical" | "high" | "medium" | "low" | "info"
        public int Count { get; set; }                   // para badge por item (opcional)
        public string? Href { get; set; }                // link a pantalla
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; }                 // según UserNotificationState
    }

    public class NotificationSummaryDto
    {
        public int UnreadCount { get; set; }
        public List<NotificationDto> Items { get; set; } = new();
    }
}
