using Blazored.LocalStorage;
using Mega7.SHARED.Entities;
using Mega7.WebA;
using Mega7.WebA.Services;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using MudBlazor.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// ---------------------------------------------------------
// 1) HttpClient BASE (solo para recursos públicos)
// ---------------------------------------------------------
builder.Services.AddScoped(sp =>
    new HttpClient { BaseAddress = new Uri("https://localhost:7284") }); // tu API URL

// ---------------------------------------------------------
// 2) AuthService (login / logout)
// ---------------------------------------------------------
builder.Services.AddScoped<AuthService>();

// ---------------------------------------------------------
// 3) AuthenticationStateProvider propio para JWT
// ---------------------------------------------------------
builder.Services.AddBlazoredLocalStorage();
builder.Services.AddAuthorizationCore();
builder.Services.AddScoped<SecureLocalStorage>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<AuthenticationStateProvider, JwtAuthStateProvider>();

builder.Services.AddScoped(sp =>
    new MasterDataService<Category>(sp.GetRequiredService<HttpClient>(), "categories"));
builder.Services.AddScoped(sp =>
    new MasterDataService<SubCategory>(sp.GetRequiredService<HttpClient>(), "subcategories"));
builder.Services.AddScoped(sp =>
    new MasterDataService<UnitOfMeasure>(sp.GetRequiredService<HttpClient>(), "unitsofmeasure"));
builder.Services.AddScoped(sp =>
    new MasterDataService<Brand>(sp.GetRequiredService<HttpClient>(), "brands"));
builder.Services.AddScoped(sp =>
    new MasterDataService<Tax>(sp.GetRequiredService<HttpClient>(), "taxes"));
builder.Services.AddScoped(sp =>
    new MasterDataService<Warehouse>(sp.GetRequiredService<HttpClient>(), "warehouses"));
builder.Services.AddScoped(sp =>
    new MasterDataService<Batch>(sp.GetRequiredService<HttpClient>(), "batches"));

builder.Services.AddMudServices();
builder.Services.AddAuthorizationCore();

await builder.Build().RunAsync();
