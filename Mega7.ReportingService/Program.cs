

using Mega7.ReportingService.Helpers;

var builder = WebApplication.CreateBuilder(args);

// licencia desde appsettings
Bold.Licensing.BoldLicenseProvider.RegisterLicense("YTaBp2RNxyfwQD232Dgumk3w6hHaq8RBShLa+kA8iG8=");

builder.Services.AddControllers();

// REQUIRED: Report Viewer usa cache en servidor
builder.Services.AddMemoryCache();

// CORS para Next.js
builder.Services.AddCors(options =>
{
    options.AddPolicy("front", p =>
        p.WithOrigins("http://localhost:3000")
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// ✅ IMPORTANT: aplicar CORS (te faltaba)
app.UseCors("front");

app.UseMiddleware<InternalApiKeyMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();
