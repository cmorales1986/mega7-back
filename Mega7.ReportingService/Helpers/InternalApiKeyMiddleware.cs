namespace Mega7.ReportingService.Helpers
{
    public class InternalApiKeyMiddleware
    {
        private readonly RequestDelegate _next;
        public InternalApiKeyMiddleware(RequestDelegate next) => _next = next;

        public async Task Invoke(HttpContext ctx, IConfiguration config)
        {
            // Permití swagger en dev si querés
            if (ctx.Request.Path.StartsWithSegments("/swagger"))
            {
                await _next(ctx);
                return;
            }

            var expected = config["Reporting:ApiKey"];
            var got = ctx.Request.Headers["X-Reporting-Key"].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(expected) || got != expected)
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsync("Unauthorized");
                return;
            }

            await _next(ctx);
        }
    }
}
