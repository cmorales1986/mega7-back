namespace Mega7.SHARED.DTOs
{
    public class AuthResponse
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string? Token { get; set; } // opcional
    }
}
