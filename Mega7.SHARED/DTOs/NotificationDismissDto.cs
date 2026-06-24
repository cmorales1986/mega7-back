namespace Mega7.API.DTOs
{
    public class NotificationDismissDto
    {
        public string Key { get; set; } = null!;
        public int? Minutes { get; set; } // opcional, si no viene usamos default
    }
}
