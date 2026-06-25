using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [ApiController]
    [Route("api/accountingconfig")]
    [Authorize(Roles = "ADMIN,SUPERVISOR")]
    public class AccountingConfigController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        public AccountingConfigController(Mega7DbContext ctx) => _ctx = ctx;

        // ── GET /api/accountingconfig  → toda la config de una vez ───────────
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var global = await _ctx.AccountingConfigs
                .AsNoTracking()
                .Include(c => c.Account)
                .OrderBy(c => c.Group).ThenBy(c => c.Label)
                .Select(c => new {
                    c.Id, c.Key, c.Label, c.Group, c.AccountId,
                    AccountCode = c.Account != null ? c.Account.Code : null,
                    AccountName = c.Account != null ? c.Account.Name : null,
                })
                .ToListAsync();

            var cashBoxes = await _ctx.CashBoxes
                .AsNoTracking()
                .Include(c => c.Account)
                .OrderBy(c => c.Name)
                .Select(c => new {
                    c.Id, c.Name, c.IsActive, c.AccountId,
                    AccountCode = c.Account != null ? c.Account.Code : null,
                    AccountName = c.Account != null ? c.Account.Name : null,
                })
                .ToListAsync();

            var bankAccounts = await _ctx.BankAccounts
                .AsNoTracking()
                .Include(b => b.Account)
                .Include(b => b.Bank)
                .Where(b => b.IsActive)
                .OrderBy(b => b.Alias)
                .Select(b => new {
                    b.Id, b.Alias, b.AccountNumber, b.Currency,
                    BankName = b.Bank != null ? b.Bank.Name : null,
                    b.AccountId,
                    AccountCode = b.Account != null ? b.Account.Code : null,
                    AccountName = b.Account != null ? b.Account.Name : null,
                })
                .ToListAsync();

            var taxes = await _ctx.Taxes
                .AsNoTracking()
                .Include(t => t.SalesAccount)
                .Include(t => t.PurchaseAccount)
                .OrderBy(t => t.Name)
                .Select(t => new {
                    t.Id, t.Name, t.Rate,
                    t.SalesAccountId,
                    SalesAccountCode = t.SalesAccount != null ? t.SalesAccount.Code : null,
                    SalesAccountName = t.SalesAccount != null ? t.SalesAccount.Name : null,
                    t.PurchaseAccountId,
                    PurchaseAccountCode = t.PurchaseAccount != null ? t.PurchaseAccount.Code : null,
                    PurchaseAccountName = t.PurchaseAccount != null ? t.PurchaseAccount.Name : null,
                })
                .ToListAsync();

            return Ok(new { global, cashBoxes, bankAccounts, taxes });
        }

        // ── PUT /api/accountingconfig/global  → actualizar claves globales ───
        [HttpPut("global")]
        public async Task<IActionResult> UpdateGlobal([FromBody] List<GlobalConfigDto> items)
        {
            foreach (var item in items)
            {
                var cfg = await _ctx.AccountingConfigs.FirstOrDefaultAsync(c => c.Key == item.Key);
                if (cfg == null) continue;

                // Validar que la cuenta no sea título
                if (item.AccountId.HasValue)
                {
                    var acc = await _ctx.Accounts.FindAsync(item.AccountId.Value);
                    if (acc == null) return BadRequest($"Cuenta {item.AccountId} no encontrada.");
                    if (acc.IsTitle) return BadRequest($"No se puede asignar una cuenta título ({acc.Code}) a '{item.Key}'.");
                }

                cfg.AccountId = item.AccountId;
            }
            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // ── PUT /api/accountingconfig/cashbox/{id} ────────────────────────────
        [HttpPut("cashbox/{id:int}")]
        public async Task<IActionResult> UpdateCashBox(int id, [FromBody] AccountLinkDto dto)
        {
            var box = await _ctx.CashBoxes.FindAsync(id);
            if (box == null) return NotFound();

            if (dto.AccountId.HasValue)
            {
                var acc = await _ctx.Accounts.FindAsync(dto.AccountId.Value);
                if (acc == null) return BadRequest("Cuenta no encontrada.");
                if (acc.IsTitle) return BadRequest($"No se puede asignar una cuenta título ({acc.Code}).");
            }

            box.AccountId = dto.AccountId;
            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // ── PUT /api/accountingconfig/bankaccount/{id} ────────────────────────
        [HttpPut("bankaccount/{id:int}")]
        public async Task<IActionResult> UpdateBankAccount(int id, [FromBody] AccountLinkDto dto)
        {
            var bank = await _ctx.BankAccounts.FindAsync(id);
            if (bank == null) return NotFound();

            if (dto.AccountId.HasValue)
            {
                var acc = await _ctx.Accounts.FindAsync(dto.AccountId.Value);
                if (acc == null) return BadRequest("Cuenta no encontrada.");
                if (acc.IsTitle) return BadRequest($"No se puede asignar una cuenta título ({acc.Code}).");
            }

            bank.AccountId = dto.AccountId;
            await _ctx.SaveChangesAsync();
            return Ok();
        }

        // ── PUT /api/accountingconfig/tax/{id} ───────────────────────────────
        [HttpPut("tax/{id:int}")]
        public async Task<IActionResult> UpdateTax(int id, [FromBody] TaxAccountDto dto)
        {
            var tax = await _ctx.Taxes.FindAsync(id);
            if (tax == null) return NotFound();

            foreach (var (accId, label) in new[] {
                (dto.SalesAccountId,    "Ventas"),
                (dto.PurchaseAccountId, "Compras") })
            {
                if (accId.HasValue)
                {
                    var acc = await _ctx.Accounts.FindAsync(accId.Value);
                    if (acc == null) return BadRequest($"Cuenta {label} no encontrada.");
                    if (acc.IsTitle) return BadRequest($"No se puede asignar una cuenta título ({acc.Code}) al impuesto ({label}).");
                }
            }

            tax.SalesAccountId    = dto.SalesAccountId;
            tax.PurchaseAccountId = dto.PurchaseAccountId;
            await _ctx.SaveChangesAsync();
            return Ok();
        }
    }

    public class GlobalConfigDto
    {
        public string Key       { get; set; } = "";
        public int? AccountId   { get; set; }
    }

    public class AccountLinkDto
    {
        public int? AccountId { get; set; }
    }

    public class TaxAccountDto
    {
        public int? SalesAccountId    { get; set; }
        public int? PurchaseAccountId { get; set; }
    }
}
