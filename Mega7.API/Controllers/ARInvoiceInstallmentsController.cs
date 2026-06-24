using Mega7.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ARInvoiceInstallmentsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        public ARInvoiceInstallmentsController(Mega7DbContext ctx) => _ctx = ctx;

        // GET: api/arinvoiceinstallments/by-invoice/12
        [HttpGet("by-invoice/{arInvoiceId:int}")]
        public async Task<IActionResult> GetByInvoice(int arInvoiceId)
        {
            var list = await _ctx.ARInvoiceInstallments
                .AsNoTracking()
                .Where(x => x.ARInvoiceId == arInvoiceId)
                .OrderBy(x => x.Number)
                .Select(x => new
                {
                    x.Id,
                    x.ARInvoiceId,
                    InstallmentNo = x.Number,
                    x.DueDate,
                    x.Amount,
                    x.PaidAmount,
                    x.Balance,
                    Status = x.IsPaid ? "PAID" : "OPEN"
                })
                .ToListAsync();

            return Ok(list);
        }
    }
}
