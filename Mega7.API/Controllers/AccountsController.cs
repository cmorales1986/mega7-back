using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [ApiController]
    [Route("api/accounts")]
    [Authorize]
    public class AccountsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public AccountsController(Mega7DbContext ctx) => _ctx = ctx;

        // ── GET /api/accounts  → árbol anidado ────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetTree()
        {
            // Cargo todo en memoria y armo el árbol manualmente
            // (evita recursión infinita de EF en lazy loading)
            var all = await _ctx.Accounts
                .AsNoTracking()
                .OrderBy(a => a.Code)
                .ToListAsync();

            // Armar diccionario y asignar children
            var dict = all.ToDictionary(a => a.Id);
            foreach (var a in all)
            {
                a.Children = new();
                if (a.ParentId.HasValue && dict.TryGetValue(a.ParentId.Value, out var parent))
                    parent.Children.Add(a);
            }

            var roots = all.Where(a => a.ParentId == null).ToList();
            return Ok(roots.Select(MapNode));
        }

        // ── GET /api/accounts/flat  → lista plana para dropdowns ─────────────
        [HttpGet("flat")]
        public async Task<IActionResult> GetFlat([FromQuery] bool titlesOnly = false, [FromQuery] bool activeOnly = true)
        {
            var q = _ctx.Accounts.AsNoTracking().AsQueryable();
            if (activeOnly)    q = q.Where(a => a.IsActive);
            if (titlesOnly)    q = q.Where(a => a.IsTitle);

            var list = await q.OrderBy(a => a.Code).ToListAsync();
            return Ok(list.Select(a => new {
                a.Id, a.Code, a.Name, a.Level, a.IsTitle,
                Type = a.Type.ToString(), Nature = a.Nature.ToString(), a.IsActive
            }));
        }

        // ── POST /api/accounts ────────────────────────────────────────────────
        [HttpPost]
        [Authorize(Roles = "ADMIN,SUPERVISOR")]
        public async Task<IActionResult> Create([FromBody] AccountDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code))  return BadRequest("El código es obligatorio.");
            if (string.IsNullOrWhiteSpace(dto.Name))  return BadRequest("El nombre es obligatorio.");

            if (await _ctx.Accounts.AnyAsync(a => a.Code == dto.Code.Trim()))
                return Conflict($"Ya existe una cuenta con código '{dto.Code}'.");

            // Si tiene padre, validar que el padre sea título
            if (dto.ParentId.HasValue)
            {
                var parent = await _ctx.Accounts.FindAsync(dto.ParentId.Value);
                if (parent == null) return BadRequest("La cuenta padre no existe.");
                if (!parent.IsTitle) return BadRequest("Solo se puede agregar hijos a cuentas título.");
            }

            var acc = new Account
            {
                Code        = dto.Code.Trim().ToUpper(),
                Name        = dto.Name.Trim().ToUpper(),
                Description = dto.Description?.Trim(),
                Level       = dto.Level,
                IsTitle     = dto.IsTitle,
                Type        = dto.Type,
                Nature      = dto.Nature,
                IsActive    = dto.IsActive,
                ParentId    = dto.ParentId,
            };

            _ctx.Accounts.Add(acc);
            await _ctx.SaveChangesAsync();
            return Ok(new { acc.Id, acc.Code, acc.Name });
        }

        // ── PUT /api/accounts/{id} ────────────────────────────────────────────
        [HttpPut("{id:int}")]
        [Authorize(Roles = "ADMIN,SUPERVISOR")]
        public async Task<IActionResult> Update(int id, [FromBody] AccountDto dto)
        {
            var acc = await _ctx.Accounts.FindAsync(id);
            if (acc == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("El nombre es obligatorio.");

            // Código: solo permitir cambio si es única
            var newCode = dto.Code.Trim().ToUpper();
            if (newCode != acc.Code && await _ctx.Accounts.AnyAsync(a => a.Code == newCode && a.Id != id))
                return Conflict($"Ya existe otra cuenta con código '{newCode}'.");

            // No permitir quitar IsTitle si tiene hijos
            if (acc.IsTitle && !dto.IsTitle)
            {
                var hasChildren = await _ctx.Accounts.AnyAsync(a => a.ParentId == id);
                if (hasChildren) return BadRequest("No se puede convertir en cuenta de movimiento una cuenta con subcuentas.");
            }

            acc.Code        = newCode;
            acc.Name        = dto.Name.Trim().ToUpper();
            acc.Description = dto.Description?.Trim();
            acc.Level       = dto.Level;
            acc.IsTitle     = dto.IsTitle;
            acc.Type        = dto.Type;
            acc.Nature      = dto.Nature;
            acc.IsActive    = dto.IsActive;
            acc.ParentId    = dto.ParentId;

            await _ctx.SaveChangesAsync();
            return Ok(new { acc.Id, acc.Code, acc.Name });
        }

        // ── DELETE /api/accounts/{id} ─────────────────────────────────────────
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(int id)
        {
            var acc = await _ctx.Accounts.FindAsync(id);
            if (acc == null) return NotFound();

            var hasChildren = await _ctx.Accounts.AnyAsync(a => a.ParentId == id);
            if (hasChildren) return BadRequest("No se puede eliminar una cuenta que tiene subcuentas.");

            // TODO: bloquear si tiene asientos (cuando se implemente JournalEntries)

            _ctx.Accounts.Remove(acc);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private static List<Account> BuildTree(List<Account> all, int? parentId)
        {
            return all.Where(a => a.ParentId == parentId).ToList();
        }

        private static object MapNode(Account a)
        {
            return new
            {
                a.Id, a.Code, a.Name, a.Description, a.Level,
                a.IsTitle, a.IsActive, a.ParentId,
                Type   = a.Type.ToString(),
                Nature = a.Nature.ToString(),
                Children = a.Children.OrderBy(c => c.Code).Select(MapNode).ToList()
            };
        }
    }

    public class AccountDto
    {
        public string Code        { get; set; } = "";
        public string Name        { get; set; } = "";
        public string? Description{ get; set; }
        public int Level          { get; set; } = 1;
        public bool IsTitle       { get; set; } = false;
        public AccountType Type   { get; set; } = AccountType.Activo;
        public AccountNature Nature{ get; set; } = AccountNature.Deudora;
        public bool IsActive      { get; set; } = true;
        public int? ParentId      { get; set; }
    }
}
