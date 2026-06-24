using Mega7.API.Data;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Services
{
    public class PeriodService
    {
        private readonly Mega7DbContext _ctx;

        public PeriodService(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        public async Task<bool> HasOpenPeriodForDate(DateTime date)
        {
            var d = date.Date;

            return await _ctx.Periods.AnyAsync(p =>
                p.IsActive &&
                p.IsOpen &&
                p.StartDate.Date <= d &&
                p.EndDate.Date >= d
            );
        }

        public async Task EnsureOpenPeriodOrThrow(DateTime date, string errorMessage)
        {
            if (!await HasOpenPeriodForDate(date))
                throw new InvalidOperationException(errorMessage);
        }

        public async Task<bool> IsPeriodOpenForDate(DateTime date) => await HasOpenPeriodForDate(date);
    }
}
