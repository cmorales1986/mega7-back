namespace Mega7.SHARED.Entities
{
    public class AppRole
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;       // "ADMIN", "VENTAS", etc. — uppercase
        public string? Description { get; set; }
        public bool IsSystem { get; set; } = false;     // roles del sistema no se pueden borrar
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
