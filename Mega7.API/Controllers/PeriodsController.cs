using Mega7.API.Attributes;
using Mega7.API.Data;
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
    public class PeriodsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public PeriodsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // =========================================================
        // GET: api/periods
        // =========================================================
        [RequirePermission(Perms.PeriodsView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.Periods
                .Where(p => p.IsActive)
                .OrderByDescending(p => p.Year)
                .ThenByDescending(p => p.Month)
                .ToListAsync();

            return Ok(list);
        }

        // =========================================================
        // GET: api/periods/5
        // =========================================================
        [RequirePermission(Perms.PeriodsView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var period = await _ctx.Periods.FindAsync(id);

            if (period == null)
                return NotFound();

            return Ok(period);
        }

        // =========================================================
        // POST: api/periods
        // =========================================================
        [RequirePermission(Perms.PeriodsCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(PeriodCreateDto model)
        {
            if (model.Year < 2000 || model.Year > 2100)
                return BadRequest("Año inválido.");

            if (model.Month < 1 || model.Month > 12)
                return BadRequest("Mes inválido.");

            // Validar duplicado por Año+Mes (solo activos)
            bool exists = await _ctx.Periods.AnyAsync(p =>
                p.IsActive &&
                p.Year == model.Year &&
                p.Month == model.Month);

            if (exists)
                return BadRequest("Ya existe un período para ese Año/Mes.");

            var start = new DateTime(model.Year, model.Month, 1, 12, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(model.Year, model.Month, 1, 12, 0, 0, DateTimeKind.Utc)
                          .AddMonths(1).AddDays(-1);

            var period = new Period
            {
                Year = model.Year,
                Month = model.Month,
                StartDate = start,
                EndDate = end,

                IsOpen = model.IsOpen,     // default abierto
                IsActive = model.IsActive, // default activo

                CreatedAt = DateTime.UtcNow,
                ClosedAt = null
            };

            _ctx.Periods.Add(period);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = period.Id }, period);
        }

        // =========================================================
        // PUT: api/periods/5
        // - Permite ajustar IsActive/IsOpen (si querés), y recalcula fechas si cambian Year/Month
        // =========================================================
        [RequirePermission(Perms.PeriodsCreate)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, PeriodUpdateDto model)
        {
            var period = await _ctx.Periods.FindAsync(id);

            if (period == null)
                return NotFound();

            if (model.Year < 2000 || model.Year > 2100)
                return BadRequest("Año inválido.");

            if (model.Month < 1 || model.Month > 12)
                return BadRequest("Mes inválido.");

            // Validar duplicado por Año+Mes (en otro registro)
            bool dup = await _ctx.Periods.AnyAsync(p =>
                p.IsActive &&
                p.Id != id &&
                p.Year == model.Year &&
                p.Month == model.Month);

            if (dup)
                return BadRequest("Ya existe otro período para ese Año/Mes.");

            // Si cambió Year/Month, recalcular fechas
            if (period.Year != model.Year || period.Month != model.Month)
            {
                var start = new DateTime(model.Year, model.Month, 1, 12, 0, 0, DateTimeKind.Utc);
                var end = new DateTime(model.Year, model.Month, 1, 12, 0, 0, DateTimeKind.Utc)
                              .AddMonths(1).AddDays(-1);

                period.Year = model.Year;
                period.Month = model.Month;
                period.StartDate = start;
                period.EndDate = end;
            }

            // Flags
            if (model.IsActive.HasValue)
                period.IsActive = model.IsActive.Value;

            if (model.IsOpen.HasValue)
            {
                // Si lo están cerrando desde Update, setear ClosedAt
                if (period.IsOpen && model.IsOpen.Value == false)
                    period.ClosedAt = DateTime.UtcNow;

                // Si lo re-abren, limpiar ClosedAt
                if (!period.IsOpen && model.IsOpen.Value == true)
                    period.ClosedAt = null;

                period.IsOpen = model.IsOpen.Value;
            }

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // =========================================================
        // POST: api/periods/5/close
        // =========================================================
        [RequirePermission(Perms.PeriodsClose)]
        [HttpPost("{id}/close")]
        public async Task<IActionResult> Close(int id)
        {
            var period = await _ctx.Periods.FindAsync(id);

            if (period == null)
                return NotFound();

            if (!period.IsActive)
                return BadRequest("El período está inactivo.");

            if (!period.IsOpen)
                return BadRequest("El período ya está cerrado.");

            period.IsOpen = false;
            period.ClosedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return Ok(period);
        }

        // =========================================================
        // POST: api/periods/5/open
        // (Opcional: reabrir)
        // =========================================================
        [RequirePermission(Perms.PeriodsOpen)]
        [HttpPost("{id}/open")]
        public async Task<IActionResult> Open(int id)
        {
            var period = await _ctx.Periods.FindAsync(id);

            if (period == null)
                return NotFound();

            if (!period.IsActive)
                return BadRequest("El período está inactivo.");

            if (period.IsOpen)
                return BadRequest("El período ya está abierto.");

            period.IsOpen = true;
            period.ClosedAt = null;

            await _ctx.SaveChangesAsync();
            return Ok(period);
        }

        // =========================================================
        // DELETE: api/periods/5
        // Recomendación: si ya lo usás en movimientos, NO borrar.
        // Acá hago "soft delete" (IsActive=false).
        // =========================================================
        [RequirePermission(Perms.PeriodsDeactivate)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var period = await _ctx.Periods.FindAsync(id);

            if (period == null)
                return NotFound();

            // Soft delete
            period.IsActive = false;

            // Si estaba abierto, opcionalmente cerrarlo
            if (period.IsOpen)
            {
                period.IsOpen = false;
                period.ClosedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return NoContent();
        }
    }
}
