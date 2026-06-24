using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ReportMenuController : ControllerBase
{
    private readonly Mega7DbContext _ctx;
    public ReportMenuController(Mega7DbContext ctx) => _ctx = ctx;

    private string GetUserRole()
    {
        var r = User.FindFirstValue(ClaimTypes.Role)
                ?? User.FindFirstValue("role")
                ?? "";
        return r.Trim().ToUpperInvariant();
    }

    private static bool IsVisibleForRole(string? rowRole, string userRole)
    {
        // NULL / vacío / ALL => todos
        if (string.IsNullOrWhiteSpace(rowRole)) return true;

        var norm = rowRole.Trim().ToUpperInvariant();
        if (norm == "ALL") return true;

        // Soporta múltiple: "ADMIN,VENTAS,CAJERO"
        var allowed = norm
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.ToUpperInvariant())
            .ToHashSet();

        // si no hay role en el usuario, solo ve los ALL/vacíos
        if (string.IsNullOrWhiteSpace(userRole)) return false;

        return allowed.Contains(userRole);
    }

    [RequirePermission(Perms.ReportMenuView)]
    [HttpGet]
    public async Task<ActionResult<List<ReportMenuItemDto>>> Get()
    {
        var userRole = GetUserRole();

        // Traemos todo activo primero (porque IsVisibleForRole no se traduce a SQL fácilmente)
        var rows = await _ctx.ReportMenus
            .Where(x => x.IsActive)
            .OrderBy(x => x.Orden)
            .Select(x => new ReportMenuItemDto
            {
                Id = x.Id,
                Nombre = x.Nombre,
                Titulo = x.Titulo,
                Color = x.Color,
                Icono = x.Icono,
                Url = x.Url,
                IdPadre = x.IdPadre,
                Orden = x.Orden,
                Role = x.Role
            })
            .ToListAsync();

        // ✅ Filtrado por rol
        rows = rows.Where(x => IsVisibleForRole(x.Role, userRole)).ToList();

        // Armar árbol
        var lookup = rows.ToDictionary(x => x.Id);
        var roots = new List<ReportMenuItemDto>();

        foreach (var item in rows)
        {
            if (item.IdPadre is null) roots.Add(item);
            else if (lookup.TryGetValue(item.IdPadre.Value, out var parent))
                parent.Children.Add(item);
            else
                roots.Add(item);
        }

        // ordenar tree
        void SortTree(List<ReportMenuItemDto> list)
        {
            list.Sort((a, b) => a.Orden.CompareTo(b.Orden));
            foreach (var n in list) SortTree(n.Children);
        }
        SortTree(roots);

        return Ok(roots);
    }
}
