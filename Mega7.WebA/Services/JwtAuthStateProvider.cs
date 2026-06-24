using Microsoft.AspNetCore.Components.Authorization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Mega7.WebA.Services
{
    public class JwtAuthStateProvider : AuthenticationStateProvider
    {
        private readonly HttpClient _http;
        private string _token = "";
        private readonly SecureLocalStorage _storage;

        public JwtAuthStateProvider(HttpClient http, SecureLocalStorage storage)
        {
            _http = http;
            _storage = storage; // <- guardamos instancia inyectada
        }

        public override async Task<AuthenticationState> GetAuthenticationStateAsync()
        {
            // Si el token no está cargado en memoria, intentamos recuperarlo del LocalStorage
            if (string.IsNullOrEmpty(_token))
            {
                var saved = await _storage.GetAsync("auth_token");
                _token = saved ?? "";
            }

            // Si sigue sin token → usuario no autenticado
            if (string.IsNullOrEmpty(_token))
            {
                return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
            }

            // Construir los claims desde el token
            var identity = BuildClaims(_token);

            // Configurar HttpClient para enviar el token en cada request
            _http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);

            return new AuthenticationState(new ClaimsPrincipal(identity));
        }

        public async Task SetTokenAsync(string token)
        {
            _token = token;

            // ✔ AHORA usamos la instancia NO estática
            await _storage.SetAsync("auth_token", token);

            NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
        }

        public async Task ClearTokenAsync()
        {
            _token = "";

            // ✔ BORRAR token de LocalStorage real
            await _storage.RemoveAsync("auth_token");

            _http.DefaultRequestHeaders.Authorization = null;

            NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
        }

        private ClaimsIdentity BuildClaims(string jwt)
        {
            var handler = new JwtSecurityTokenHandler();
            var token = handler.ReadJwtToken(jwt);

            return new ClaimsIdentity(token.Claims, "jwt");
        }
    }
}
