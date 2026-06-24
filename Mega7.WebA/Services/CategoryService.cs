using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using System.Net.Http.Json;

public class CategoryService
{
    private readonly HttpClient _http;

    public CategoryService(HttpClient http)
    {
        _http = http;
    }

    public async Task<bool> UpdateAsync(int id, string name, bool isActive)
    {
        var dto = new CategoryUpdateDto
        {
            Name = name,
            IsActive = isActive
        };

        var res = await _http.PutAsJsonAsync($"api/categories/{id}", dto);
        return res.IsSuccessStatusCode;
    }

}
