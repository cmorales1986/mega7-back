using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;

namespace Mega7.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly Mega7DbContext _ctx;

        // Usuarios conectados: connectionId → info. Static porque el Hub es transiente.
        private static readonly ConcurrentDictionary<string, OnlineUser> _online = new();

        private record OnlineUser(int UserId, string Username, string FullName);

        public ChatHub(Mega7DbContext ctx) => _ctx = ctx;

        // ── Conexión ─────────────────────────────────────────────────────────
        public override async Task OnConnectedAsync()
        {
            var (userId, username, fullName) = GetUserInfo();
            _online[Context.ConnectionId] = new OnlineUser(userId, username, fullName);

            await Clients.All.SendAsync("OnlineUpdated", BuildOnlineList());
            await base.OnConnectedAsync();
        }

        // ── Desconexión ───────────────────────────────────────────────────────
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _online.TryRemove(Context.ConnectionId, out _);
            await Clients.All.SendAsync("OnlineUpdated", BuildOnlineList());
            await base.OnDisconnectedAsync(exception);
        }

        // ── Enviar mensaje ────────────────────────────────────────────────────
        public async Task SendMessage(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;

            var (userId, username, fullName) = GetUserInfo();
            var trimmed = text.Trim();
            if (trimmed.Length > 500) trimmed = trimmed[..500];

            var msg = new Message
            {
                UserId   = userId,
                Username = username,
                FullName = fullName,
                Text     = trimmed,
                SentAt   = DateTime.UtcNow,
            };

            _ctx.Messages.Add(msg);
            await _ctx.SaveChangesAsync();

            await Clients.All.SendAsync("ReceiveMessage", new
            {
                msg.Id,
                msg.UserId,
                msg.Username,
                msg.FullName,
                msg.Text,
                sentAt = msg.SentAt.ToString("o"),
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private (int UserId, string Username, string FullName) GetUserInfo()
        {
            var user = Context.User!;
            var userId   = int.TryParse(user.FindFirst("uid")?.Value, out var id) ? id : 0;
            var username = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? "";
            var fullName = user.FindFirst("name")?.Value ?? username;
            return (userId, username, fullName);
        }

        private static List<object> BuildOnlineList() =>
            _online.Values
                .GroupBy(u => u.UserId)
                .Select(g => g.First())
                .Select(u => (object)new { u.Username, u.FullName })
                .ToList();
    }
}
