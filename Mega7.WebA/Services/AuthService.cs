using Mega7.SHARED.DTOs;
using Microsoft.AspNetCore.Components.Authorization;
using System.Net.Http.Json;

namespace Mega7.WebA.Services
{
    public class AuthService
    {
        private readonly HttpClient _http;
        private readonly JwtAuthStateProvider _authState;

        public AuthService(HttpClient http, AuthenticationStateProvider authProvider)
        {
            _http = http;
            _authState = (JwtAuthStateProvider)authProvider;
        }

        public async Task<bool> LoginAsync(string user, string pass)
        {
            var body = new LoginRequest
            {
                UserOrEmail = user,
                Password = pass
            };

            var response = await _http.PostAsJsonAsync("api/auth/login", body);

            if (!response.IsSuccessStatusCode)
                return false;

            var data = await response.Content.ReadFromJsonAsync<AuthResponse>();

            if (data == null || string.IsNullOrWhiteSpace(data.Token))
                return false;

            // 🔥 Guardamos token y notificamos autenticación
            await _authState.SetTokenAsync(data.Token);

            return true;
        }

        public async Task LogoutAsync()
        {
            await _authState.ClearTokenAsync();
        }
    }
}
