using Mega7.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class APInvoiceInstallmentsController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;
        public APInvoiceInstallmentsController(Mega7DbContext ctx) => _ctx = ctx;

        [HttpGet("by-invoice/{apInvoiceId:int}")]
        public async Task<IActionResult> GetByInvoice(int apInvoiceId)
        {
            var list = await _ctx.APInvoiceInstallments
                .AsNoTracking()
                .Where(x => x.APInvoiceId == apInvoiceId)
                .OrderBy(x => x.InstallmentNo)
                .Select(x => new
                {
                    x.Id,
                    x.APInvoiceId,
                    x.InstallmentNo,
                    x.DueDate,
                    x.Amount,
                    x.PaidAmount,
                    x.Balance,
                    x.Status
                })
                .ToListAsync();

            return Ok(list);
        }
    }
}
