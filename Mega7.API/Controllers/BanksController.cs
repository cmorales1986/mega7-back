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
    public class BanksController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        private readonly PeriodService _periods;

        public BanksController(Mega7DbContext ctx, PeriodService periods)
        {
            _ctx = ctx;
            _periods = periods;
        }

        // =========================
        // BANKS (ABM)
        // =========================
        [RequirePermission(Perms.BanksView)]
        [HttpGet]
        public async Task<IActionResult> GetBanks()
        {
            var list = await _ctx.Banks
                .OrderBy(x => x.Name)
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.BanksView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetBank(int id)
        {
            var bank = await _ctx.Banks
                .Include(x => x.Accounts)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (bank == null) return NotFound();
            return Ok(bank);
        }

        [RequirePermission(Perms.BanksCreate)]
        [HttpPost]
        public async Task<IActionResult> CreateBank(BankUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre del banco es obligatorio.");

            var model = new Bank
            {
                Code = (dto.Code ?? "").Trim(),
                Name = dto.Name.Trim(),
                IsActive = dto.IsActive
            };

            _ctx.Banks.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBank), new { id = model.Id }, model);
        }

        [RequirePermission(Perms.BanksEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBank(int id, BankUpsertDto dto)
        {
            var bank = await _ctx.Banks.FindAsync(id);
            if (bank == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("El nombre del banco es obligatorio.");

            bank.Code = (dto.Code ?? "").Trim();
            bank.Name = dto.Name.Trim();
            bank.IsActive = dto.IsActive;
            bank.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        [RequirePermission(Perms.BanksEdit)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBank(int id)
        {
            var bank = await _ctx.Banks.FindAsync(id);
            if (bank == null) return NotFound();

            var hasAccounts = await _ctx.BankAccounts.AnyAsync(a => a.BankId == id);
            if (hasAccounts)
                return BadRequest("No se puede eliminar: el banco tiene cuentas. Desactívelo en su lugar.");

            _ctx.Banks.Remove(bank);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        // =========================
        // ACCOUNTS
        // =========================
        [RequirePermission(Perms.BanksView)]
        [HttpGet("accounts")]
        public async Task<IActionResult> GetAccounts()
        {
            var list = await _ctx.BankAccounts
                .Include(a => a.Bank)
                .OrderBy(a => a.Bank!.Name)
                .ThenBy(a => a.Alias)
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.BanksView)]
        [HttpGet("accounts/{id}")]
        public async Task<IActionResult> GetAccount(int id)
        {
            var acc = await _ctx.BankAccounts
                .Include(a => a.Bank)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (acc == null) return NotFound();
            return Ok(acc);
        }

        [RequirePermission(Perms.BanksCreate)]
        [HttpPost("accounts")]
        public async Task<IActionResult> CreateAccount(BankAccountUpsertDto dto)
        {
            var bank = await _ctx.Banks.FindAsync(dto.BankId);
            if (bank == null) return BadRequest("El banco no existe.");

            if (string.IsNullOrWhiteSpace(dto.Alias))
                return BadRequest("El alias es obligatorio.");

            if (string.IsNullOrWhiteSpace(dto.Currency))
                return BadRequest("La moneda es obligatoria.");

            if (!await _periods.HasOpenPeriodForDate(dto.InitialBalanceDate))
                return BadRequest("No existe un período ABIERTO para la fecha del saldo inicial.");

            var model = new BankAccount
            {
                BankId = dto.BankId,
                AccountNumber = (dto.AccountNumber ?? "").Trim(),
                Alias = dto.Alias.Trim(),
                Currency = dto.Currency.Trim().ToUpper(),
                InitialBalance = dto.InitialBalance,
                InitialBalanceDate = dto.InitialBalanceDate.Date,
                IsActive = dto.IsActive
            };

            _ctx.BankAccounts.Add(model);
            await _ctx.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAccount), new { id = model.Id }, model);
        }

        [RequirePermission(Perms.BanksEdit)]
        [HttpPut("accounts/{id}")]
        public async Task<IActionResult> UpdateAccount(int id, BankAccountUpsertDto dto)
        {
            var acc = await _ctx.BankAccounts.FindAsync(id);
            if (acc == null) return NotFound();

            var bank = await _ctx.Banks.FindAsync(dto.BankId);
            if (bank == null) return BadRequest("El banco no existe.");

            if (string.IsNullOrWhiteSpace(dto.Alias))
                return BadRequest("El alias es obligatorio.");

            if (string.IsNullOrWhiteSpace(dto.Currency))
                return BadRequest("La moneda es obligatoria.");

            if (!await _periods.HasOpenPeriodForDate(dto.InitialBalanceDate))
                return BadRequest("No existe un período ABIERTO para la fecha del saldo inicial.");

            acc.BankId = dto.BankId;
            acc.AccountNumber = (dto.AccountNumber ?? "").Trim();
            acc.Alias = dto.Alias.Trim();
            acc.Currency = dto.Currency.Trim().ToUpper();
            acc.InitialBalance = dto.InitialBalance;
            acc.InitialBalanceDate = dto.InitialBalanceDate.Date;
            acc.IsActive = dto.IsActive;
            acc.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        [RequirePermission(Perms.BanksEdit)]
        [HttpDelete("accounts/{id}")]
        public async Task<IActionResult> DeleteAccount(int id)
        {
            var acc = await _ctx.BankAccounts.FindAsync(id);
            if (acc == null) return NotFound();

            var hasMoves = await _ctx.BankMovements.AnyAsync(m =>
                !m.IsCancelled &&
                (m.AccountId == id || m.FromAccountId == id || m.ToAccountId == id));

            if (hasMoves)
                return BadRequest("No se puede eliminar: la cuenta tiene movimientos. Desactívela en su lugar.");

            _ctx.BankAccounts.Remove(acc);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }

        // =========================
        // MOVEMENTS
        // =========================
        [RequirePermission(Perms.BanksView)]
        [HttpGet("movements")]
        public async Task<IActionResult> GetMovements(
            [FromQuery] int? accountId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var q = _ctx.BankMovements
                .AsNoTracking()
                .Include(m => m.Account)!.ThenInclude(a => a!.Bank)
                .Include(m => m.FromAccount)!.ThenInclude(a => a!.Bank)
                .Include(m => m.ToAccount)!.ThenInclude(a => a!.Bank)
                .Where(m => !m.IsCancelled)
                .AsQueryable();

            if (accountId.HasValue)
            {
                var id = accountId.Value;
                q = q.Where(m => m.AccountId == id || m.FromAccountId == id || m.ToAccountId == id);
            }

            if (from.HasValue) q = q.Where(m => m.Date.Date >= from.Value.Date);
            if (to.HasValue) q = q.Where(m => m.Date.Date <= to.Value.Date);

            var list = await q
                .OrderByDescending(m => m.Date)
                .ThenByDescending(m => m.Id)
                .ToListAsync();

            return Ok(list);
        }

        // GET /banks/accounts/balances?asOf=2026-01-06
        [RequirePermission(Perms.BanksView)]
        [HttpGet("accounts/balances")]
        public async Task<ActionResult<List<BankAccountBalanceDto>>> GetAccountBalances([FromQuery] DateTime? asOf = null)
        {
            var cutoff = (asOf ?? DateTime.Today).Date.AddDays(1).AddTicks(-1); // fin del día

            // Traer cuentas + banco
            var accounts = await _ctx.BankAccounts
                .AsNoTracking()
                .Include(a => a.Bank)
                .Select(a => new
                {
                    a.Id,
                    a.BankId,
                    BankName = a.Bank != null ? a.Bank.Name : "",
                    a.Alias,
                    a.Currency,
                    a.InitialBalance,
                    a.IsActive
                })
                .ToListAsync();

            var ids = accounts.Select(a => a.Id).ToList();

            // Movimientos netos por cuenta (IN/OUT)
            var inOut = await _ctx.BankMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date <= cutoff && m.AccountId != null && ids.Contains(m.AccountId.Value))
                .GroupBy(m => m.AccountId!.Value)
                .Select(g => new
                {
                    AccountId = g.Key,
                    Net = g.Sum(x => x.Type == "IN" ? x.Amount : x.Type == "OUT" ? -x.Amount : 0m)
                })
                .ToListAsync();

            // Transferencias: origen (-) y destino (+)
            var transfersOut = await _ctx.BankMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date <= cutoff && m.Type == "TRANSFER" && m.FromAccountId != null && ids.Contains(m.FromAccountId.Value))
                .GroupBy(m => m.FromAccountId!.Value)
                .Select(g => new { AccountId = g.Key, Net = g.Sum(x => -x.Amount) })
                .ToListAsync();

            var transfersIn = await _ctx.BankMovements
                .AsNoTracking()
                .Where(m => !m.IsCancelled && m.Date <= cutoff && m.Type == "TRANSFER" && m.ToAccountId != null && ids.Contains(m.ToAccountId.Value))
                .GroupBy(m => m.ToAccountId!.Value)
                .Select(g => new { AccountId = g.Key, Net = g.Sum(x => x.Amount) })
                .ToListAsync();

            // Consolidar nets en diccionario
            var netByAccount = new Dictionary<int, decimal>();

            void AddNet(IEnumerable<dynamic> rows)
            {
                foreach (var r in rows)
                {
                    int id = (int)r.AccountId;
                    decimal net = (decimal)r.Net;
                    netByAccount[id] = (netByAccount.TryGetValue(id, out var v) ? v : 0m) + net;
                }
            }

            AddNet(inOut);
            AddNet(transfersOut);
            AddNet(transfersIn);

            var result = accounts.Select(a =>
            {
                var net = netByAccount.TryGetValue(a.Id, out var v) ? v : 0m;
                var current = (a.InitialBalance) + net;

                return new BankAccountBalanceDto
                {
                    AccountId = a.Id,
                    BankId = a.BankId,
                    BankName = a.BankName,
                    Alias = a.Alias,
                    Currency = a.Currency,
                    InitialBalance = a.InitialBalance,
                    MovementsNet = net,
                    CurrentBalance = current,
                    AsOf = cutoff,
                    IsActive = a.IsActive
                };
            }).ToList();

            return Ok(result);
        }

        [RequirePermission(Perms.BanksCreate)]
        [HttpPost("movements")]
        public async Task<IActionResult> CreateMovement(BankMovementCreateDto dto)
        {
            if (dto.Amount <= 0)
                return BadRequest("El monto debe ser mayor a 0.");

            var type = (dto.Type ?? "").Trim().ToUpper();
            if (type != "IN" && type != "OUT" && type != "TRANSFER")
                return BadRequest("Type inválido. Use IN, OUT o TRANSFER.");

            // Normalizar fecha
            var date = dto.Date == default ? DateTime.UtcNow : dto.Date;

            if (!await _periods.HasOpenPeriodForDate(date))
                return BadRequest("No existe un período ABIERTO para la fecha del movimiento.");

            if (type == "IN" || type == "OUT")
            {
                if (!dto.AccountId.HasValue)
                    return BadRequest("AccountId es obligatorio para IN/OUT.");

                var acc = await _ctx.BankAccounts
                    .Include(a => a.Bank)
                    .FirstOrDefaultAsync(a => a.Id == dto.AccountId.Value);

                if (acc == null) return BadRequest("La cuenta no existe.");
                if (!acc.IsActive) return BadRequest("La cuenta está inactiva.");

                var m = new BankMovement
                {
                    Date = date,
                    Type = type,
                    AccountId = acc.Id,
                    Amount = dto.Amount,
                    Currency = acc.Currency,
                    Description = (dto.Description ?? "").Trim(),
                    Reference = (dto.Reference ?? "").Trim(),
                };

                _ctx.BankMovements.Add(m);
                await _ctx.SaveChangesAsync();
                return Ok(m);
            }

            // TRANSFER
            if (!dto.FromAccountId.HasValue || !dto.ToAccountId.HasValue)
                return BadRequest("FromAccountId y ToAccountId son obligatorios para TRANSFER.");

            if (dto.FromAccountId.Value == dto.ToAccountId.Value)
                return BadRequest("No se puede transferir a la misma cuenta.");

            var fromAcc = await _ctx.BankAccounts.FirstOrDefaultAsync(a => a.Id == dto.FromAccountId.Value);
            var toAcc = await _ctx.BankAccounts.FirstOrDefaultAsync(a => a.Id == dto.ToAccountId.Value);

            if (fromAcc == null || toAcc == null)
                return BadRequest("Cuenta origen/destino inválida.");

            if (!fromAcc.IsActive || !toAcc.IsActive)
                return BadRequest("Cuenta origen/destino inactiva.");

            if (!string.Equals(fromAcc.Currency, toAcc.Currency, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Transferencia entre monedas distintas no soportada (por ahora).");

            var mov = new BankMovement
            {
                Date = date,
                Type = "TRANSFER",
                FromAccountId = fromAcc.Id,
                ToAccountId = toAcc.Id,
                Amount = dto.Amount,
                Currency = fromAcc.Currency,
                Description = (dto.Description ?? "").Trim(),
                Reference = (dto.Reference ?? "").Trim(),
            };

            _ctx.BankMovements.Add(mov);
            await _ctx.SaveChangesAsync();
            return Ok(mov);
        }

        [RequirePermission(Perms.BanksEdit)]
        [HttpPost("movements/{id}/cancel")]
        public async Task<IActionResult> CancelMovement(int id)
        {
            var mov = await _ctx.BankMovements.FindAsync(id);
            if (mov == null) return NotFound();

            if (mov.IsCancelled) return BadRequest("El movimiento ya está cancelado.");

            if (!await _periods.HasOpenPeriodForDate(mov.Date))
                return BadRequest("No existe un período ABIERTO para la fecha del movimiento a cancelar.");

            mov.IsCancelled = true;
            await _ctx.SaveChangesAsync();

            return Ok(new { cancelled = true });
        }

        // =========================
        // BALANCE (por cuenta y fecha)
        // =========================
        [RequirePermission(Perms.BanksView)]
        [HttpGet("accounts/{id}/balance")]
        public async Task<IActionResult> GetAccountBalance(int id, [FromQuery] DateTime? at)
        {
            var acc = await _ctx.BankAccounts
                .Include(a => a.Bank)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (acc == null) return NotFound();

            var cut = (at ?? DateTime.UtcNow).Date;

            // base: saldo inicial si InitialBalanceDate <= cut (si no, base 0)
            decimal balance = acc.InitialBalanceDate.Date <= cut ? acc.InitialBalance : 0m;

            // IN/OUT hasta fecha
            var inOut = await _ctx.BankMovements
                .Where(m => !m.IsCancelled && m.Date.Date <= cut && m.AccountId == id && (m.Type == "IN" || m.Type == "OUT"))
                .Select(m => new { m.Type, m.Amount })
                .ToListAsync();

            balance += inOut.Where(x => x.Type == "IN").Sum(x => x.Amount);
            balance -= inOut.Where(x => x.Type == "OUT").Sum(x => x.Amount);

            // TRANSFERS hasta fecha: si soy origen resto, si soy destino sumo
            var transfers = await _ctx.BankMovements
                .Where(m => !m.IsCancelled && m.Date.Date <= cut && m.Type == "TRANSFER" &&
                            (m.FromAccountId == id || m.ToAccountId == id))
                .Select(m => new { m.FromAccountId, m.ToAccountId, m.Amount })
                .ToListAsync();

            balance -= transfers.Where(t => t.FromAccountId == id).Sum(t => t.Amount);
            balance += transfers.Where(t => t.ToAccountId == id).Sum(t => t.Amount);

            return Ok(new
            {
                accountId = acc.Id,
                bank = acc.Bank?.Name,
                alias = acc.Alias,
                currency = acc.Currency,
                at = cut,
                balance
            });
        }
    }
}
