using Mega7.SHARED.DTOs;

namespace Mega7.Server.Services
{
    public class AuthService
    {
        private readonly HttpClient _http;
        private readonly CustomAuthStateProvider _authProvider;

        public AuthService(HttpClient http, CustomAuthStateProvider authProvider)
        {
            _http = http;
            _authProvider = authProvider;
        }

        public async Task<bool> LoginAsync(string username, string password)
        {
            var response = await _http.PostAsJsonAsync("api/auth/login", new
            {
                username,
                password
            });

            if (!response.IsSuccessStatusCode)
                return false;

            var result = await response.Content.ReadFromJsonAsync<AuthResponse>();

            if (result == null)
                return false;

            _authProvider.NotifyUserAuthenticated(result.Username);

            return true;
        }


        public void Logout()
        {
            _authProvider.NotifyUserLogout();
        }
    }
}
