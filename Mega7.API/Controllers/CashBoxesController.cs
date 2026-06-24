using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Services;
using Mega7.API.Utils;
using Mega7.SHARED.DTOs;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CashBoxesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public CashBoxesController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // =========================
        // CASH BOXES (ABM)
        // =========================
        [RequirePermission(Perms.CashBoxesView)]
        [HttpGet]
        public async Task<IActionResult> GetCashBoxes()
        {
            var list = await _ctx.CashBoxes
                .AsNoTracking()
                .OrderBy(x => x.Name)
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.CashBoxesCreate)]
        [HttpPost]
        public async Task<IActionResult> CreateCashBox(CashBoxUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre de la caja es obligatorio.");

            var model = new CashBox
            {
                Name = dto.Name.Trim(),
                IsActive = dto.IsActive
            };

            _ctx.CashBoxes.Add(model);
            await _ctx.SaveChangesAsync();
            return Ok(model);
        }

        [RequirePermission(Perms.CashBoxesEdit)]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateCashBox(int id, CashBoxUpsertDto dto)
        {
            var box = await _ctx.CashBoxes.FindAsync(id);
            if (box == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre de la caja es obligatorio.");

            box.Name = dto.Name.Trim();
            box.IsActive = dto.IsActive;
            box.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        [RequirePermission(Perms.CashBoxesEdit)]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteCashBox(int id)
        {
            var box = await _ctx.CashBoxes.FindAsync(id);
            if (box == null) return NotFound();

            var hasMoves = await _ctx.CashMovements.AnyAsync(m =>
                !m.IsCancelled && (m.CashBoxId == id || m.FromCashBoxId == id || m.ToCashBoxId == id));

            var hasSessions = await _ctx.CashSessions.AnyAsync(s => s.CashBoxId == id);

            if (hasMoves || hasSessions)
                return BadRequest("No se puede eliminar: la caja tiene movimientos o sesiones. Desactívela.");

            _ctx.CashBoxes.Remove(box);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // =========================
        // CATEGORIES (ABM)
        // =========================
        [RequirePermission(Perms.CashBoxesView)]
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var list = await _ctx.CashCategories
                .AsNoTracking()
                .OrderBy(x => x.Name)
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.CashBoxesCreate)]
        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory(CashCategoryUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre de la categoría es obligatorio.");

            var model = new CashCategory
            {
                Name = dto.Name.Trim(),
                IsActive = dto.IsActive
            };

            _ctx.CashCategories.Add(model);
            await _ctx.SaveChangesAsync();
            return Ok(model);
        }

        [RequirePermission(Perms.CashBoxesEdit)]
        [HttpPut("categories/{id:int}")]
        public async Task<IActionResult> UpdateCategory(int id, CashCategoryUpsertDto dto)
        {
            var cat = await _ctx.CashCategories.FindAsync(id);
            if (cat == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre de la categoría es obligatorio.");

            cat.Name = dto.Name.Trim();
            cat.IsActive = dto.IsActive;
            cat.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        [RequirePermission(Perms.CashBoxesEdit)]
        [HttpDelete("categories/{id:int}")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var cat = await _ctx.CashCategories.FindAsync(id);
            if (cat == null) return NotFound();

            var used = await _ctx.CashMovements.AnyAsync(m => !m.IsCancelled && m.CategoryId == id);
            if (used)
                return BadRequest("No se puede eliminar: la categoría está usada. Desactívela.");

            _ctx.CashCategories.Remove(cat);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // =========================
        // SESSIONS (Apertura/Cierre)
        // =========================
        // POST api/cashboxes/{id}/open
        [RequirePermission(Perms.CashBoxesCreate)]
        [HttpPost("{id:int}/open")]
        public async Task<IActionResult> OpenSession(int id, CashSessionOpenDto dto)
        {
            var date = dto.Date.Date;

            if (!await _periods.HasOpenPeriodForDate(date))
                return BadRequest("No existe un período ABIERTO para la fecha.");

            var box = await _ctx.CashBoxes.FindAsync(id);
            if (box == null) return NotFound("Caja no existe.");
            if (!box.IsActive) return BadRequest("Caja inactiva.");

            var exists = await _ctx.CashSessions.FirstOrDefaultAsync(s => s.CashBoxId == id && s.Date == date);
            if (exists != null)
            {
                if (!exists.IsClosed) return Ok(new { ok = true, sessionId = exists.Id, message = "Ya existe una sesión abierta." });
                return BadRequest("Ya existe una sesión cerrada para esa fecha.");
            }

            var s = new CashSession
            {
                CashBoxId = id,
                Date = date,
                OpeningBalance = dto.OpeningBalance,
                OpenedAt = DateTime.UtcNow,
                IsClosed = false
            };

            _ctx.CashSessions.Add(s);
            await _ctx.SaveChangesAsync();
            return Ok(new { ok = true, sessionId = s.Id });
        }

        // POST api/cashboxes/{id}/close
        [RequirePermission(Perms.CashBoxesEdit)]
        [HttpPost("{id:int}/close")]
        public async Task<IActionResult> CloseSession(int id, CashSessionCloseDto dto)
        {
            var date = dto.Date.Date;

            if (!await _periods.HasOpenPeriodForDate(date))
                return BadRequest("No existe un período ABIERTO para la fecha.");

            var s = await _ctx.CashSessions.FirstOrDefaultAsync(x => x.CashBoxId == id && x.Date == date);
            if (s == null) return BadRequest("No existe sesión abierta para esa fecha.");
            if (s.IsClosed) return BadRequest("La sesión ya está cerrada.");

            // saldo sistema al cierre: apertura + neto movimientos del día
            var cutoffEnd = date.AddDays(1).AddTicks(-1);

            var netInOut = await _ctx.CashMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date <= cutoffEnd && m.CashBoxId == id && (m.Type == "IN" || m.Type == "OUT"))
                .SumAsync(m => m.Type == "IN" ? m.Amount : -m.Amount);

            var netTransfersOut = await _ctx.CashMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date <= cutoffEnd && m.Type == "TRANSFER" && m.FromCashBoxId == id)
                .SumAsync(m => -m.Amount);

            var netTransfersIn = await _ctx.CashMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date <= cutoffEnd && m.Type == "TRANSFER" && m.ToCashBoxId == id)
                .SumAsync(m => m.Amount);

            var systemBalance = s.OpeningBalance + netInOut + netTransfersOut + netTransfersIn;

            s.IsClosed = true;
            s.CountedCash = dto.CountedCash;
            s.ClosingBalanceSystem = systemBalance;
            s.Difference = dto.CountedCash - systemBalance;
            s.CloseNotes = (dto.Notes ?? "").Trim();
            s.ClosedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return Ok(new { ok = true, s.Id, s.Date, s.ClosingBalanceSystem, s.CountedCash, s.Difference });
        }

        // GET api/cashboxes/sessions?date=YYYY-MM-DD
        [RequirePermission(Perms.CashBoxesView)]
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions([FromQuery] DateTime? date = null)
        {
            var d = (date ?? DateTime.UtcNow).Date;

            var list = await _ctx.CashSessions
                .AsNoTracking()
                .Include(x => x.CashBox)
                .Where(x => x.Date == d)
                .OrderBy(x => x.CashBox!.Name)
                .Select(x => new
                {
                    x.Id,
                    x.Date,
                    x.CashBoxId,
                    CashBoxName = x.CashBox != null ? x.CashBox.Name : "",
                    x.OpeningBalance,
                    x.IsClosed,
                    x.CountedCash,
                    x.ClosingBalanceSystem,
                    x.Difference,
                    x.OpenedAt,
                    x.ClosedAt,
                    x.CloseNotes
                })
                .ToListAsync();

            return Ok(list);
        }

        // =========================
        // MOVEMENTS
        // =========================
        [RequirePermission(Perms.CashBoxesView)]
        [HttpGet("movements")]
        public async Task<IActionResult> GetMovements([FromQuery] int? cashBoxId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var q = _ctx.CashMovements
                .AsNoTracking()
                .Include(m => m.CashBox)
                .Include(m => m.FromCashBox)
                .Include(m => m.ToCashBox)
                .Include(m => m.Category)
                .Where(m => !m.IsCancelled)
                .AsQueryable();

            if (cashBoxId.HasValue)
            {
                var id = cashBoxId.Value;
                q = q.Where(m => m.CashBoxId == id || m.FromCashBoxId == id || m.ToCashBoxId == id);
            }

            if (from.HasValue) q = q.Where(m => m.Date.Date >= from.Value.Date);
            if (to.HasValue) q = q.Where(m => m.Date.Date <= to.Value.Date);

            var list = await q
                .OrderByDescending(m => m.Date)
                .ThenByDescending(m => m.Id)
                .Select(m => new
                {
                    m.Id,
                    m.Date,
                    m.Type,
                    m.Amount,
                    m.Currency,
                    m.Description,
                    m.Reference,
                    m.CategoryId,
                    Category = m.Category == null ? null : new { m.Category.Id, m.Category.Name },
                    CashBox = m.CashBox == null ? null : new { m.CashBox.Id, m.CashBox.Name },
                    FromCashBox = m.FromCashBox == null ? null : new { m.FromCashBox.Id, m.FromCashBox.Name },
                    ToCashBox = m.ToCashBox == null ? null : new { m.ToCashBox.Id, m.ToCashBox.Name },
                    m.IsCancelled
                })
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.CashBoxesCreate)]
        [HttpPost("movements")]
        public async Task<IActionResult> CreateMovement(CashMovementCreateDto dto)
        {
            if (dto.Amount <= 0) return BadRequest("El monto debe ser mayor a 0.");

            var type = (dto.Type ?? "").Trim().ToUpperInvariant();
            if (type != "IN" && type != "OUT" && type != "TRANSFER")
                return BadRequest("Type inválido. Use IN, OUT o TRANSFER.");

            var date = (dto.Date == default ? DateTime.UtcNow : dto.Date).Date;

            if (!await _periods.HasOpenPeriodForDate(date))
                return BadRequest("No existe un período ABIERTO para la fecha del movimiento.");

            if (type == "IN" || type == "OUT")
            {
                if (!dto.CashBoxId.HasValue) return BadRequest("CashBoxId es obligatorio para IN/OUT.");

                var box = await _ctx.CashBoxes.FindAsync(dto.CashBoxId.Value);
                if (box == null) return BadRequest("La caja no existe.");
                if (!box.IsActive) return BadRequest("La caja está inactiva.");

                // Si querés exigir sesión abierta para Caja Principal, acá es donde se valida.
                // (Por simplicidad: exigimos sesión abierta para cualquier caja; podés aflojar después)
                var s = await _ctx.CashSessions.FirstOrDefaultAsync(x => x.CashBoxId == box.Id && x.Date == date);
                if (s == null || s.IsClosed) return BadRequest("No hay sesión abierta para esa caja y fecha. Abrí caja primero.");

                var mov = new CashMovement
                {
                    Date = date,
                    Type = type,
                    Currency = "PYG",
                    CashBoxId = box.Id,
                    Amount = dto.Amount,
                    CategoryId = dto.CategoryId,
                    Description = (dto.Description ?? "").Trim(),
                    Reference = (dto.Reference ?? "").Trim()
                };

                _ctx.CashMovements.Add(mov);
                await _ctx.SaveChangesAsync();
                return Ok(mov);
            }

            // TRANSFER
            if (!dto.FromCashBoxId.HasValue || !dto.ToCashBoxId.HasValue)
                return BadRequest("FromCashBoxId y ToCashBoxId son obligatorios para TRANSFER.");

            if (dto.FromCashBoxId.Value == dto.ToCashBoxId.Value)
                return BadRequest("No se puede transferir a la misma caja.");

            var fromBox = await _ctx.CashBoxes.FindAsync(dto.FromCashBoxId.Value);
            var toBox = await _ctx.CashBoxes.FindAsync(dto.ToCashBoxId.Value);
            if (fromBox == null || toBox == null) return BadRequest("Caja origen/destino inválida.");
            if (!fromBox.IsActive || !toBox.IsActive) return BadRequest("Caja origen/destino inactiva.");

            var sFrom = await _ctx.CashSessions.FirstOrDefaultAsync(x => x.CashBoxId == fromBox.Id && x.Date == date);
            var sTo = await _ctx.CashSessions.FirstOrDefaultAsync(x => x.CashBoxId == toBox.Id && x.Date == date);
            if (sFrom == null || sFrom.IsClosed) return BadRequest("Caja origen: no hay sesión abierta.");
            if (sTo == null || sTo.IsClosed) return BadRequest("Caja destino: no hay sesión abierta.");

            var tmov = new CashMovement
            {
                Date = date,
                Type = "TRANSFER",
                Currency = "PYG",
                FromCashBoxId = fromBox.Id,
                ToCashBoxId = toBox.Id,
                Amount = dto.Amount,
                Description = (dto.Description ?? "").Trim(),
                Reference = (dto.Reference ?? "").Trim()
            };

            _ctx.CashMovements.Add(tmov);
            await _ctx.SaveChangesAsync();
            return Ok(tmov);
        }

        [RequirePermission(Perms.CashBoxesEdit)]
        [HttpPost("movements/{id:int}/cancel")]
        public async Task<IActionResult> CancelMovement(int id, [FromBody] string? reason = null)
        {
            var mov = await _ctx.CashMovements.FindAsync(id);
            if (mov == null) return NotFound();

            if (mov.IsCancelled) return BadRequest("El movimiento ya está cancelado.");

            // validar periodo por la fecha del movimiento (importante)
            if (!await _periods.HasOpenPeriodForDate(mov.Date.Date))
                return BadRequest("No existe período ABIERTO para la fecha del movimiento. No se puede cancelar.");

            mov.IsCancelled = true;
            mov.CancelledAt = DateTime.UtcNow;
            mov.CancelReason = string.IsNullOrWhiteSpace(reason) ? "Cancelado manualmente." : reason.Trim();

            await _ctx.SaveChangesAsync();
            return Ok(new { cancelled = true });
        }

        // =========================
        // BALANCES (saldo actual por caja)
        // =========================
        // GET api/cashboxes/balances?asOf=2026-01-06
        [RequirePermission(Perms.CashBoxesView)]
        [HttpGet("balances")]
        public async Task<ActionResult<List<CashBoxBalanceDto>>> GetBalances([FromQuery] DateTime? asOf = null)
        {
            var d = (asOf ?? DateTime.Today).Date;
            var cutoffEnd = d.AddDays(1).AddTicks(-1);

            var boxes = await _ctx.CashBoxes
                .AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new { x.Id, x.Name, x.IsActive })
                .ToListAsync();

            var boxIds = boxes.Select(x => x.Id).ToList();

            // opening balance del día (si hay sesión)
            var sessions = await _ctx.CashSessions
                .AsNoTracking()
                .Where(s => s.Date == d && boxIds.Contains(s.CashBoxId))
                .Select(s => new
                {
                    s.CashBoxId,
                    s.OpeningBalance,
                    s.IsClosed
                })
                .ToListAsync();

            var sessionMap = sessions.ToDictionary(x => x.CashBoxId, x => x);

            // neto movimientos hasta cutoffEnd (acumulado desde siempre) + apertura del día no aplica si acumulado...
            // Para dashboard “saldo actual”, lo más coherente es:
            // saldo = (ultima sesión abierta de cada caja?) sería más complejo.
            // Entonces hacemos: saldo = suma de apertura del día + neto del día (si querés “saldo del día”)
            // y para “saldo acumulado”, lo ideal es fijar una fecha de arranque (primera sesión) o usar un “saldo inicial global”.
            //
            // ✅ Para v1 simple: saldo del día (apertura del día + movimientos del día).

            var start = d.Date;
            var end = cutoffEnd;

            var inOut = await _ctx.CashMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date >= start && m.Date <= end && m.CashBoxId != null && boxIds.Contains(m.CashBoxId.Value))
                .GroupBy(m => m.CashBoxId!.Value)
                .Select(g => new
                {
                    CashBoxId = g.Key,
                    Net = g.Sum(x => x.Type == "IN" ? x.Amount : x.Type == "OUT" ? -x.Amount : 0m)
                })
                .ToListAsync();

            var transfersOut = await _ctx.CashMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date >= start && m.Date <= end && m.Type == "TRANSFER" && m.FromCashBoxId != null && boxIds.Contains(m.FromCashBoxId.Value))
                .GroupBy(m => m.FromCashBoxId!.Value)
                .Select(g => new { CashBoxId = g.Key, Net = g.Sum(x => -x.Amount) })
                .ToListAsync();

            var transfersIn = await _ctx.CashMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date >= start && m.Date <= end && m.Type == "TRANSFER" && m.ToCashBoxId != null && boxIds.Contains(m.ToCashBoxId.Value))
                .GroupBy(m => m.ToCashBoxId!.Value)
                .Select(g => new { CashBoxId = g.Key, Net = g.Sum(x => x.Amount) })
                .ToListAsync();

            var netByBox = new Dictionary<int, decimal>();
            void Add(IEnumerable<(int id, decimal net)> rows)
            {
                foreach (var r in rows)
                    netByBox[r.id] = (netByBox.TryGetValue(r.id, out var v) ? v : 0m) + r.net;
            }

            Add(inOut.Select(x => (x.CashBoxId, x.Net)));
            Add(transfersOut.Select(x => (x.CashBoxId, x.Net)));
            Add(transfersIn.Select(x => (x.CashBoxId, x.Net)));

            var result = boxes.Select(b =>
            {
                var hasSession = sessionMap.TryGetValue(b.Id, out var s);
                var opening = hasSession ? s!.OpeningBalance : 0m;
                var net = netByBox.TryGetValue(b.Id, out var v) ? v : 0m;

                return new CashBoxBalanceDto
                {
                    CashBoxId = b.Id,
                    CashBoxName = b.Name,
                    OpeningBalance = opening,
                    MovementsNet = net,
                    CurrentBalance = opening + net,
                    AsOf = d,
                    IsActive = b.IsActive,
                    HasOpenSession = hasSession && !s!.IsClosed,
                    IsClosed = hasSession && s!.IsClosed
                };
            }).ToList();

            return Ok(result);
        }
    }
}
