using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers;

[ApiController]
[Route("api/accountingreports")]
[Authorize]
public class AccountingReportsController : ControllerBase
{
    private readonly Mega7DbContext _ctx;
    public AccountingReportsController(Mega7DbContext ctx) => _ctx = ctx;

    private static DateTime ParseDate(string? s, DateTime fallback)
        => DateTime.TryParse(s, out var d) ? d.Date : fallback.Date;

    // ── Balance de Comprobación ───────────────────────────────────────────────
    // Agrupa líneas de asientos contabilizados por cuenta y calcula
    // totales Debe / Haber / Saldo en el período indicado.
    [HttpGet("trial-balance")]
    public async Task<IActionResult> TrialBalance(
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        var fromDt = ParseDate(from, new DateTime(DateTime.UtcNow.Year, 1, 1));
        var toDt   = ParseDate(to,   DateTime.UtcNow.Date).AddDays(1); // exclusive

        var grouped = await _ctx.JournalEntryLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.Status == JournalEntryStatus.Contabilizado
                     && l.JournalEntry.Date >= fromDt
                     && l.JournalEntry.Date < toDt)
            .GroupBy(l => l.AccountId)
            .Select(g => new {
                AccountId   = g.Key,
                TotalDebit  = g.Sum(l => l.Debit),
                TotalCredit = g.Sum(l => l.Credit),
            })
            .ToListAsync();

        if (!grouped.Any())
            return Ok(new { rows = Array.Empty<object>(), totals = new { totalDebit = 0m, totalCredit = 0m } });

        var ids = grouped.Select(g => g.AccountId).ToList();
        var accounts = await _ctx.Accounts.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        var rows = grouped
            .Where(g => accounts.ContainsKey(g.AccountId))
            .Select(g => {
                var acc = accounts[g.AccountId];
                var balance = acc.Nature == AccountNature.Deudora
                    ? g.TotalDebit - g.TotalCredit
                    : g.TotalCredit - g.TotalDebit;
                return new {
                    accountId   = acc.Id,
                    accountCode = acc.Code,
                    accountName = acc.Name,
                    accountType = acc.Type.ToString(),
                    nature      = acc.Nature.ToString(),
                    totalDebit  = g.TotalDebit,
                    totalCredit = g.TotalCredit,
                    balance,
                };
            })
            .OrderBy(r => r.accountCode)
            .ToList();

        var totals = new {
            totalDebit  = rows.Sum(r => r.totalDebit),
            totalCredit = rows.Sum(r => r.totalCredit),
        };

        return Ok(new { rows, totals });
    }

    // ── Libro Mayor ───────────────────────────────────────────────────────────
    // Devuelve saldo inicial, movimientos del período con saldo corrido,
    // y saldo final para una cuenta determinada.
    [HttpGet("ledger")]
    public async Task<IActionResult> Ledger(
        [FromQuery] int  accountId,
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        var account = await _ctx.Accounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == accountId);
        if (account == null) return NotFound("Cuenta no encontrada.");

        var fromDt = ParseDate(from, new DateTime(DateTime.UtcNow.Year, 1, 1));
        var toDt   = ParseDate(to,   DateTime.UtcNow.Date).AddDays(1);

        // Saldo acumulado ANTES del período (saldo inicial)
        var before = await _ctx.JournalEntryLines
            .AsNoTracking()
            .Where(l => l.AccountId == accountId
                     && l.JournalEntry!.Status == JournalEntryStatus.Contabilizado
                     && l.JournalEntry.Date < fromDt)
            .GroupBy(_ => 1)
            .Select(g => new { D = g.Sum(l => l.Debit), C = g.Sum(l => l.Credit) })
            .FirstOrDefaultAsync();

        decimal openD = before?.D ?? 0m;
        decimal openC = before?.C ?? 0m;
        decimal openingBalance = account.Nature == AccountNature.Deudora
            ? openD - openC
            : openC - openD;

        // Movimientos del período
        var movements = await _ctx.JournalEntryLines
            .AsNoTracking()
            .Where(l => l.AccountId == accountId
                     && l.JournalEntry!.Status == JournalEntryStatus.Contabilizado
                     && l.JournalEntry.Date >= fromDt
                     && l.JournalEntry.Date < toDt)
            .OrderBy(l => l.JournalEntry!.Date)
            .ThenBy(l => l.JournalEntryId)
            .Select(l => new {
                date      = l.JournalEntry!.Date,
                entryId   = l.JournalEntryId,
                desc      = l.JournalEntry.Description,
                reference = l.JournalEntry.Reference,
                source    = l.JournalEntry.SourceType.ToString(),
                lineDesc  = l.Description,
                debit     = l.Debit,
                credit    = l.Credit,
            })
            .ToListAsync();

        // Calcular saldo corrido
        decimal running = openingBalance;
        var rows = movements.Select(m => {
            running += account.Nature == AccountNature.Deudora
                ? m.debit - m.credit
                : m.credit - m.debit;
            return new {
                m.date, m.entryId, m.desc, m.reference,
                m.source, m.lineDesc, m.debit, m.credit,
                runningBalance = running,
            };
        }).ToList();

        return Ok(new {
            account = new {
                account.Id, account.Code, account.Name,
                type   = account.Type.ToString(),
                nature = account.Nature.ToString(),
            },
            openingBalance,
            rows,
            totalDebit     = movements.Sum(m => m.debit),
            totalCredit    = movements.Sum(m => m.credit),
            closingBalance = running,
        });
    }

    // ── Estado de Resultados ──────────────────────────────────────────────────
    // Agrupa cuentas de Ingresos / Costos / Gastos y calcula utilidad neta.
    [HttpGet("income-statement")]
    public async Task<IActionResult> IncomeStatement(
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        var fromDt = ParseDate(from, new DateTime(DateTime.UtcNow.Year, 1, 1));
        var toDt   = ParseDate(to,   DateTime.UtcNow.Date).AddDays(1);

        var grouped = await _ctx.JournalEntryLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.Status == JournalEntryStatus.Contabilizado
                     && l.JournalEntry.Date >= fromDt
                     && l.JournalEntry.Date < toDt
                     && (l.Account!.Type == AccountType.Ingresos
                      || l.Account.Type == AccountType.Costos
                      || l.Account.Type == AccountType.Gastos))
            .GroupBy(l => l.AccountId)
            .Select(g => new {
                AccountId   = g.Key,
                TotalDebit  = g.Sum(l => l.Debit),
                TotalCredit = g.Sum(l => l.Credit),
            })
            .ToListAsync();

        var ids = grouped.Select(g => g.AccountId).ToList();
        var accounts = await _ctx.Accounts.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        var rows = grouped
            .Where(g => accounts.ContainsKey(g.AccountId))
            .Select(g => {
                var acc = accounts[g.AccountId];
                var amount = acc.Nature == AccountNature.Deudora
                    ? g.TotalDebit - g.TotalCredit
                    : g.TotalCredit - g.TotalDebit;
                return new {
                    accountId   = acc.Id,
                    accountCode = acc.Code,
                    accountName = acc.Name,
                    accountType = acc.Type.ToString(),
                    amount,
                };
            })
            .OrderBy(r => r.accountCode)
            .ToList();

        decimal totalRevenues = rows.Where(r => r.accountType == "Ingresos").Sum(r => r.amount);
        decimal totalCosts    = rows.Where(r => r.accountType == "Costos").Sum(r => r.amount);
        decimal totalExpenses = rows.Where(r => r.accountType == "Gastos").Sum(r => r.amount);
        decimal grossProfit   = totalRevenues - totalCosts;
        decimal netProfit     = grossProfit - totalExpenses;

        return Ok(new {
            revenues = rows.Where(r => r.accountType == "Ingresos"),
            costs    = rows.Where(r => r.accountType == "Costos"),
            expenses = rows.Where(r => r.accountType == "Gastos"),
            totalRevenues, totalCosts, grossProfit, totalExpenses, netProfit,
        });
    }

    // ── Balance General ───────────────────────────────────────────────────────
    // Activo = Pasivo + Patrimonio + Utilidad del ejercicio (acumulada al asOf).
    [HttpGet("balance-sheet")]
    public async Task<IActionResult> BalanceSheet([FromQuery] string? asOf)
    {
        var asOfDt = ParseDate(asOf, DateTime.UtcNow.Date).AddDays(1); // exclusive

        // Cuentas patrimoniales
        var grouped = await _ctx.JournalEntryLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.Status == JournalEntryStatus.Contabilizado
                     && l.JournalEntry.Date < asOfDt
                     && (l.Account!.Type == AccountType.Activo
                      || l.Account.Type == AccountType.Pasivo
                      || l.Account.Type == AccountType.Patrimonio))
            .GroupBy(l => l.AccountId)
            .Select(g => new {
                AccountId   = g.Key,
                TotalDebit  = g.Sum(l => l.Debit),
                TotalCredit = g.Sum(l => l.Credit),
            })
            .ToListAsync();

        var ids = grouped.Select(g => g.AccountId).ToList();
        var accounts = await _ctx.Accounts.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        var rows = grouped
            .Where(g => accounts.ContainsKey(g.AccountId))
            .Select(g => {
                var acc = accounts[g.AccountId];
                var amount = acc.Nature == AccountNature.Deudora
                    ? g.TotalDebit - g.TotalCredit
                    : g.TotalCredit - g.TotalDebit;
                return new {
                    accountId   = acc.Id,
                    accountCode = acc.Code,
                    accountName = acc.Name,
                    accountType = acc.Type.ToString(),
                    amount,
                };
            })
            .OrderBy(r => r.accountCode)
            .ToList();

        // Utilidad del ejercicio (P&L) acumulada hasta asOf
        var pnlGrouped = await _ctx.JournalEntryLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.Status == JournalEntryStatus.Contabilizado
                     && l.JournalEntry.Date < asOfDt
                     && (l.Account!.Type == AccountType.Ingresos
                      || l.Account.Type == AccountType.Costos
                      || l.Account.Type == AccountType.Gastos))
            .GroupBy(l => l.AccountId)
            .Select(g => new {
                AccountId   = g.Key,
                TotalDebit  = g.Sum(l => l.Debit),
                TotalCredit = g.Sum(l => l.Credit),
            })
            .ToListAsync();

        var pnlIds = pnlGrouped.Select(g => g.AccountId).ToList();
        var pnlAccounts = await _ctx.Accounts.AsNoTracking()
            .Where(a => pnlIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        decimal revenues = 0, costs = 0, expenses = 0;
        foreach (var g in pnlGrouped.Where(g => pnlAccounts.ContainsKey(g.AccountId)))
        {
            var acc = pnlAccounts[g.AccountId];
            var amount = acc.Nature == AccountNature.Deudora
                ? g.TotalDebit - g.TotalCredit
                : g.TotalCredit - g.TotalDebit;
            if      (acc.Type == AccountType.Ingresos) revenues += amount;
            else if (acc.Type == AccountType.Costos)   costs    += amount;
            else if (acc.Type == AccountType.Gastos)   expenses += amount;
        }
        decimal retainedEarnings = revenues - costs - expenses;

        decimal totalAssets      = rows.Where(r => r.accountType == "Activo").Sum(r => r.amount);
        decimal totalLiabilities = rows.Where(r => r.accountType == "Pasivo").Sum(r => r.amount);
        decimal totalEquity      = rows.Where(r => r.accountType == "Patrimonio").Sum(r => r.amount) + retainedEarnings;

        return Ok(new {
            asOfDate = asOfDt.AddDays(-1),
            assets      = rows.Where(r => r.accountType == "Activo"),
            liabilities = rows.Where(r => r.accountType == "Pasivo"),
            equity      = rows.Where(r => r.accountType == "Patrimonio"),
            retainedEarnings,
            totalAssets,
            totalLiabilities,
            totalEquity,
            totalLiabilitiesAndEquity = totalLiabilities + totalEquity,
        });
    }
}
