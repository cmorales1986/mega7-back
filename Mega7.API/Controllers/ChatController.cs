using Mega7.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        public ChatController(Mega7DbContext ctx) => _ctx = ctx;

        /// <summary>Últimos 100 mensajes del chat grupal, ordenados del más antiguo al más nuevo.</summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var msgs = await _ctx.Messages
                .OrderByDescending(m => m.SentAt)
                .Take(100)
                .OrderBy(m => m.SentAt)
                .Select(m => new
                {
                    m.Id,
                    m.UserId,
                    m.Username,
                    m.FullName,
                    m.Text,
                    sentAt = m.SentAt.ToString("o"),
                })
                .ToListAsync();

            return Ok(msgs);
        }
    }
}
