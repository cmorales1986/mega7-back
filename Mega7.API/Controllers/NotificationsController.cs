using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.DTOs;
using Mega7.API.Utils;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public NotificationsController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        private int GetUserId()
        {
            var uid = User.FindFirst("uid")?.Value;
            if (string.IsNullOrWhiteSpace(uid)) throw new Exception("No uid in token.");
            return int.Parse(uid);
        }

        // GET: api/notifications/summary
        [RequirePermission(Perms.NotificationsView)]
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var userId = GetUserId();

            // 1) Generar alertas (hoy demo, mañana enchufás queries reales)
            var alerts = await BuildAlertsAsync();

            // 2) Estados del usuario
            var keys = alerts.Select(a => a.Key).ToList();
            var states = await _ctx.UserNotificationStates
                .Where(s => s.UserId == userId && keys.Contains(s.Key))
                .ToListAsync();

            foreach (var a in alerts)
            {
                var st = states.FirstOrDefault(x => x.Key == a.Key);

                // si está “dismissed” vigente, ni la muestres
                if (st?.DismissedUntil != null && st.DismissedUntil > DateTime.UtcNow)
                {
                    a.IsRead = true;
                    a.Count = 0;
                    a.Message = ""; // no se usa
                }
                else
                {
                    // Regla simple: si el usuario “vio” esta alerta después de que se generó, está leída.
                    a.IsRead = st?.LastSeenAt != null && st.LastSeenAt >= a.CreatedAt;
                }
            }

            // quitar las silenciadas
            var visible = alerts.Where(a => !(string.IsNullOrWhiteSpace(a.Message))).ToList();

            var unread = visible.Count(x => !x.IsRead);

            return Ok(new NotificationSummaryDto
            {
                UnreadCount = unread,
                Items = visible
                    .OrderByDescending(x => SeverityRank(x.Severity))
                    .ThenByDescending(x => x.CreatedAt)
                    .Take(12)
                    .ToList()
            });
        }

        [RequirePermission(Perms.NotificationsView)]
        [HttpPost("dismiss")]
        public async Task<IActionResult> Dismiss([FromBody] Mega7.API.DTOs.NotificationDismissDto dto)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(dto.Key)) return BadRequest("Key es obligatorio.");

            // default: 8 horas; si querés permitir custom:
            var minutes = dto.Minutes ?? (8 * 60);

            var st = await _ctx.UserNotificationStates
                .FirstOrDefaultAsync(x => x.UserId == userId && x.Key == dto.Key);

            if (st == null)
            {
                st = new UserNotificationState
                {
                    UserId = userId,
                    Key = dto.Key,
                    DismissedUntil = DateTime.UtcNow.AddMinutes(minutes)
                };
                _ctx.UserNotificationStates.Add(st);
            }
            else
            {
                st.DismissedUntil = DateTime.UtcNow.AddMinutes(minutes);
                st.UpdatedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }


        // POST: api/notifications/mark-read
        [RequirePermission(Perms.NotificationsView)]
        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkRead([FromBody] string key)
        {
            var userId = GetUserId();

            var st = await _ctx.UserNotificationStates
                .FirstOrDefaultAsync(x => x.UserId == userId && x.Key == key);

            if (st == null)
            {
                st = new UserNotificationState
                {
                    UserId = userId,
                    Key = key,
                    LastSeenAt = DateTime.UtcNow
                };
                _ctx.UserNotificationStates.Add(st);
            }
            else
            {
                st.LastSeenAt = DateTime.UtcNow;
                st.UpdatedAt = DateTime.UtcNow;
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // POST: api/notifications/mark-all-read
        [RequirePermission(Perms.NotificationsView)]
        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = GetUserId();
            var alerts = await BuildAlertsAsync();

            foreach (var a in alerts)
            {
                var st = await _ctx.UserNotificationStates
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.Key == a.Key);

                if (st == null)
                {
                    _ctx.UserNotificationStates.Add(new UserNotificationState
                    {
                        UserId = userId,
                        Key = a.Key,
                        LastSeenAt = DateTime.UtcNow
                    });
                }
                else
                {
                    st.LastSeenAt = DateTime.UtcNow;
                    st.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _ctx.SaveChangesAsync();
            return Ok();
        }

        private static int SeverityRank(string severity) => severity switch
        {
            "critical" => 5,
            "high" => 4,
            "medium" => 3,
            "low" => 2,
            _ => 1
        };

        // ✅ Acá enchufás reglas reales. Por ahora: DEMO + HREFs sugeridos.
        private async Task<List<NotificationDto>> BuildAlertsAsync()
        {
            var now = DateTime.UtcNow;
            var today = now.Date;

            var alerts = new List<NotificationDto>();

            // =========================
            // 1) CAJAS ABIERTAS SIN CERRAR (REAL)
            // =========================
            // Definición: CashSessions donde IsClosed == false.
            // Si querés SOLO HOY, descomentá el filtro por fecha.
            var openSessions = await _ctx.CashSessions
                .AsNoTracking()
                .Include(s => s.CashBox)
                .Where(s => !s.IsClosed)
                //.Where(s => !s.IsClosed && s.Date == today) // 👈 SOLO HOY (opcional)
                .OrderBy(s => s.Date)
                .ToListAsync();

            if (openSessions.Count > 0)
            {
                var oldest = openSessions.First();
                var oldestBoxName = oldest.CashBox?.Name ?? "Caja";
                var daysOpen = (today - oldest.Date.Date).Days;

                string message;
                if (openSessions.Count == 1)
                {
                    message = daysOpen <= 0
                        ? $"Hay 1 caja abierta sin cerrar ({oldestBoxName}) hoy."
                        : $"Hay 1 caja abierta sin cerrar ({oldestBoxName}) desde {oldest.Date:dd/MM/yyyy}.";
                }
                else
                {
                    message = $"Hay {openSessions.Count} cajas/sesiones abiertas sin cerrar. La más antigua: {oldestBoxName} ({oldest.Date:dd/MM/yyyy}).";
                }

                // CreatedAt: usamos OpenedAt si existe (mejor para “read”), si no, usamos la fecha.
                var createdAt = oldest.OpenedAt != default ? oldest.OpenedAt : oldest.Date;

                // Href: te mando a la pantalla de cajas (ajustá si tu ruta es otra)
                alerts.Add(new NotificationDto
                {
                    Key = "cashbox_open",
                    Title = "Cajas abiertas sin cerrar",
                    Message = message,
                    Severity = "critical",
                    Count = openSessions.Count,
                    Href = "/finance/cash-boxes",
                    CreatedAt = createdAt
                });
            }

            // =========================
            // 2) MOROSOS / FACTURAS VENCIDAS (REAL)
            // =========================
            var overdueQuery = _ctx.ARInvoices
                .AsNoTracking()
                .Where(x =>
                    x.DueDate.HasValue &&
                    x.DueDate.Value.Date < today &&
                    (x.Status ?? "OPEN").ToUpper() != "PAID" &&
                    (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                    x.Balance > 0m
                );

            var overdueInvoicesCount = await overdueQuery.CountAsync();

            var overdueCustomersCount = await overdueQuery
                .Select(x => x.CustomerId)
                .Distinct()
                .CountAsync();

            if (overdueInvoicesCount > 0)
            {
                alerts.Add(new NotificationDto
                {
                    Key = "invoices_overdue",
                    Title = "Clientes morosos / facturas vencidas",
                    Message = overdueCustomersCount == 1
                        ? $"Hay 1 cliente moroso con {overdueInvoicesCount} factura(s) vencida(s)."
                        : $"Hay {overdueCustomersCount} clientes morosos con {overdueInvoicesCount} factura(s) vencida(s).",
                    Severity = "high",
                    // Count: yo pondría clientes morosos (más “real” para cobranza).
                    // Si preferís facturas, cambiá a overdueInvoicesCount.
                    Count = overdueCustomersCount,
                    Href = "/sales-invoices?status=overdue",
                    CreatedAt = now
                });
            }

            // =========================
            // 3) FACTURAS DEL DÍA SIN COBRAR (REAL)
            // =========================
            // Definición: InvoiceDate == hoy y Balance > 0 y no cancelada
            var todayUnpaidCount = await _ctx.ARInvoices
                .AsNoTracking()
                .Where(x =>
                    x.InvoiceDate.Date == today &&
                    (x.Status ?? "OPEN").ToUpper() != "CANCELLED" &&
                    x.Balance > 0m
                )
                .CountAsync();

            if (todayUnpaidCount > 0)
            {
                alerts.Add(new NotificationDto
                {
                    Key = "today_unpaid",
                    Title = "Facturas del día sin cobrar",
                    Message = todayUnpaidCount == 1
                        ? "Tenés 1 factura de hoy sin cobro aplicado."
                        : $"Tenés {todayUnpaidCount} facturas de hoy sin cobro aplicado.",
                    Severity = "medium",
                    Count = todayUnpaidCount,
                    Href = "/sales-invoices?filter=today-unpaid",
                    CreatedAt = now
                });
            }

            return alerts;
        }

    }
}
