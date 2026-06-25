using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Mega7.API.Controllers
{
    [ApiController]
    [Route("api/journalentries")]
    [Authorize]
    public class JournalEntriesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        public JournalEntriesController(Mega7DbContext ctx) => _ctx = ctx;

        // ── GET /api/journalentries  (lista paginada con filtros) ─────────────
        [HttpGet]
        public async Task<IActionResult> GetList(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? source = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? q = null)
        {
            var query = _ctx.JournalEntries.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(source) &&
                Enum.TryParse<JournalEntrySource>(source, true, out var src))
                query = query.Where(j => j.SourceType == src);

            if (!string.IsNullOrWhiteSpace(status) &&
                Enum.TryParse<JournalEntryStatus>(status, true, out var st))
                query = query.Where(j => j.Status == st);

            if (from.HasValue) query = query.Where(j => j.Date >= from.Value);
            if (to.HasValue)   query = query.Where(j => j.Date <= to.Value);

            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(j =>
                    j.Description.Contains(q) ||
                    (j.Reference != null && j.Reference.Contains(q)));

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(j => j.Date)
                .ThenByDescending(j => j.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(j => new {
                    j.Id, j.Date, j.Description, j.Reference,
                    SourceType = j.SourceType.ToString(),
                    Status     = j.Status.ToString(),
                    j.CreatedAt, j.CreatedBy, j.SourceId,
                    TotalDebit  = j.Lines.Sum(l => l.Debit),
                    TotalCredit = j.Lines.Sum(l => l.Credit),
                    LineCount   = j.Lines.Count,
                })
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        // ── GET /api/journalentries/{id}  (detalle con líneas) ───────────────
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var entry = await _ctx.JournalEntries
                .AsNoTracking()
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .FirstOrDefaultAsync(j => j.Id == id);

            if (entry == null) return NotFound();

            return Ok(new {
                entry.Id, entry.Date, entry.Description, entry.Reference,
                SourceType = entry.SourceType.ToString(),
                Status     = entry.Status.ToString(),
                entry.CreatedAt, entry.CreatedBy, entry.SourceId,
                Lines = entry.Lines.Select(l => new {
                    l.Id, l.AccountId,
                    AccountCode = l.Account.Code,
                    AccountName = l.Account.Name,
                    l.Debit, l.Credit, l.Description,
                }),
                TotalDebit  = entry.Lines.Sum(l => l.Debit),
                TotalCredit = entry.Lines.Sum(l => l.Credit),
            });
        }

        // ── POST /api/journalentries  (crear borrador o contabilizar) ─────────
        [HttpPost]
        [Authorize(Roles = "ADMIN,SUPERVISOR")]
        public async Task<IActionResult> Create([FromBody] JournalEntryDto dto)
        {
            var err = ValidateDto(dto);
            if (err != null) return BadRequest(err);

            await ValidateAccounts(dto.Lines);

            var entry = new JournalEntry
            {
                Date        = dto.Date,
                Description = dto.Description.Trim(),
                Reference   = dto.Reference?.Trim(),
                SourceType  = JournalEntrySource.Manual,
                Status      = dto.Post ? JournalEntryStatus.Contabilizado : JournalEntryStatus.Borrador,
                CreatedBy   = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("sub"),
                Lines       = dto.Lines.Select(l => new JournalEntryLine {
                    AccountId   = l.AccountId,
                    Debit       = l.Debit,
                    Credit      = l.Credit,
                    Description = l.Description?.Trim(),
                }).ToList(),
            };

            _ctx.JournalEntries.Add(entry);
            await _ctx.SaveChangesAsync();
            return Ok(new { entry.Id, entry.Status });
        }

        // ── PUT /api/journalentries/{id}  (editar — solo BORRADOR) ───────────
        [HttpPut("{id:int}")]
        [Authorize(Roles = "ADMIN,SUPERVISOR")]
        public async Task<IActionResult> Update(int id, [FromBody] JournalEntryDto dto)
        {
            var entry = await _ctx.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == id);

            if (entry == null) return NotFound();
            if (entry.Status == JournalEntryStatus.Contabilizado)
                return BadRequest("No se puede editar un asiento ya contabilizado.");

            var err = ValidateDto(dto);
            if (err != null) return BadRequest(err);

            await ValidateAccounts(dto.Lines);

            entry.Date        = dto.Date;
            entry.Description = dto.Description.Trim();
            entry.Reference   = dto.Reference?.Trim();

            // Reemplazar líneas
            _ctx.JournalEntryLines.RemoveRange(entry.Lines);
            entry.Lines = dto.Lines.Select(l => new JournalEntryLine {
                AccountId   = l.AccountId,
                Debit       = l.Debit,
                Credit      = l.Credit,
                Description = l.Description?.Trim(),
            }).ToList();

            if (dto.Post) entry.Status = JournalEntryStatus.Contabilizado;

            await _ctx.SaveChangesAsync();
            return Ok(new { entry.Id, entry.Status });
        }

        // ── POST /api/journalentries/{id}/post  (contabilizar borrador) ──────
        [HttpPost("{id:int}/post")]
        [Authorize(Roles = "ADMIN,SUPERVISOR")]
        public async Task<IActionResult> Post(int id)
        {
            var entry = await _ctx.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == id);

            if (entry == null) return NotFound();
            if (entry.Status == JournalEntryStatus.Contabilizado)
                return BadRequest("El asiento ya está contabilizado.");
            if (!entry.Lines.Any())
                return BadRequest("El asiento no tiene líneas.");

            var totalDebit  = entry.Lines.Sum(l => l.Debit);
            var totalCredit = entry.Lines.Sum(l => l.Credit);
            if (totalDebit != totalCredit)
                return BadRequest($"El asiento no cuadra: Debe={totalDebit:N2} / Haber={totalCredit:N2}.");

            entry.Status = JournalEntryStatus.Contabilizado;
            await _ctx.SaveChangesAsync();
            return Ok(new { entry.Id, entry.Status });
        }

        // ── DELETE /api/journalentries/{id}  (solo BORRADOR) ─────────────────
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(int id)
        {
            var entry = await _ctx.JournalEntries.FindAsync(id);
            if (entry == null) return NotFound();
            if (entry.Status == JournalEntryStatus.Contabilizado)
                return BadRequest("No se puede eliminar un asiento contabilizado.");

            _ctx.JournalEntries.Remove(entry);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static string? ValidateDto(JournalEntryDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Description))
                return "La descripción es obligatoria.";
            if (dto.Lines == null || dto.Lines.Count < 2)
                return "Un asiento debe tener al menos 2 líneas.";
            if (dto.Lines.Any(l => l.Debit < 0 || l.Credit < 0))
                return "Los importes no pueden ser negativos.";
            if (dto.Lines.Any(l => l.Debit > 0 && l.Credit > 0))
                return "Una línea no puede tener importe en Debe y Haber al mismo tiempo.";
            if (dto.Lines.Any(l => l.Debit == 0 && l.Credit == 0))
                return "Todas las líneas deben tener un importe (Debe o Haber).";

            var totalDebit  = dto.Lines.Sum(l => l.Debit);
            var totalCredit = dto.Lines.Sum(l => l.Credit);
            if (totalDebit != totalCredit)
                return $"El asiento no cuadra: Debe={totalDebit:N2} / Haber={totalCredit:N2}.";

            return null;
        }

        private async Task ValidateAccounts(List<JournalEntryLineDto> lines)
        {
            var ids = lines.Select(l => l.AccountId).Distinct().ToList();
            var accounts = await _ctx.Accounts
                .Where(a => ids.Contains(a.Id))
                .ToListAsync();

            var missing = ids.Except(accounts.Select(a => a.Id)).ToList();
            if (missing.Any())
                throw new InvalidOperationException($"Cuentas no encontradas: {string.Join(", ", missing)}");

            var titleAccounts = accounts.Where(a => a.IsTitle).Select(a => $"{a.Code} {a.Name}").ToList();
            if (titleAccounts.Any())
                throw new InvalidOperationException(
                    $"No se puede imputar a cuentas título: {string.Join(", ", titleAccounts)}");
        }
    }

    public class JournalEntryDto
    {
        public DateTime Date        { get; set; } = DateTime.Today;
        public string Description   { get; set; } = "";
        public string? Reference    { get; set; }
        public bool Post            { get; set; } = false;  // true = contabilizar directo
        public List<JournalEntryLineDto> Lines { get; set; } = new();
    }

    public class JournalEntryLineDto
    {
        public int AccountId    { get; set; }
        public decimal Debit    { get; set; } = 0;
        public decimal Credit   { get; set; } = 0;
        public string? Description { get; set; }
    }
}
