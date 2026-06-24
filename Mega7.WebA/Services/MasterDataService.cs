using System.Net.Http.Json;

namespace Mega7.WebA.Services
{
    public class MasterDataService<T> where T : class
    {
        private readonly HttpClient _http;
        private readonly string _endpoint;

        public MasterDataService(HttpClient http, string endpoint)
        {
            _http = http;
            _endpoint = endpoint;
        }

        public async Task<List<T>> GetAllAsync()
            => await _http.GetFromJsonAsync<List<T>>($"api/{_endpoint}");

        public async Task<T?> GetByIdAsync(int id)
            => await _http.GetFromJsonAsync<T>($"api/{_endpoint}/{id}");

        public async Task<bool> CreateAsync(T data)
        {
            var res = await _http.PostAsJsonAsync($"api/{_endpoint}", data);
            return res.IsSuccessStatusCode;
        }

        public async Task<bool> UpdateAsync(int id, T data)
        {
            var res = await _http.PutAsJsonAsync($"api/{_endpoint}/{id}", data);
            return res.IsSuccessStatusCode;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var res = await _http.DeleteAsync($"api/{_endpoint}/{id}");
            return res.IsSuccessStatusCode;
        }
    }
}
