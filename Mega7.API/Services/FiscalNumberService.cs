using Mega7.API.Data;
using Mega7.SHARED.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Services
{
    public record FiscalNumberReservation(
        int SeriesId,
        string DocumentType,
        string Timbrado,
        string Establishment,
        string ExpeditionPoint,
        int Number,
        string FullNumber
    );

    public class FiscalNumberService
    {
        private readonly Mega7DbContext _ctx;

        public FiscalNumberService(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        /// <summary>
        /// Reserva por criterios (legacy): tipo + establecimiento + punto expedición + seriesName (opcional).
        /// - Si seriesName es null => toma cualquier serie activa para ese tipo/001-001
        /// </summary>
        public async Task<FiscalNumberReservation> ReserveAsync(
            string documentType,
            string establishment = "001",
            string expeditionPoint = "001",
            string? seriesName = null,
            DateTime? onDate = null
        )
        {
            documentType = (documentType ?? "FACTURA").Trim().ToUpperInvariant();
            establishment = (establishment ?? "001").Trim();
            expeditionPoint = (expeditionPoint ?? "001").Trim();
            seriesName = string.IsNullOrWhiteSpace(seriesName) ? null : seriesName.Trim();

            var date = (onDate ?? DateTime.UtcNow).Date;

            for (int attempt = 1; attempt <= 5; attempt++)
            {
                // ✅ tracked (necesario para incrementar NextNumber)
                var q = _ctx.Set<FiscalDocumentSeries>()
                    .Where(x =>
                        x.IsActive &&
                        x.DocumentType == documentType &&
                        x.Establishment == establishment &&
                        x.ExpeditionPoint == expeditionPoint &&
                        // ✅ FIX: si seriesName es null => no filtra por SeriesName
                        (seriesName == null || (x.SeriesName != null && x.SeriesName.Trim() == seriesName)) &&
                        // ✅ opcional pero recomendable: solo series vigentes
                        date >= x.ValidFrom.Date &&
                        date <= x.ValidTo.Date
                    );

                var s = await q
                    .OrderByDescending(x => x.Id)
                    .FirstOrDefaultAsync();

                if (s == null)
                    throw new Exception(
                        $"No hay talonario activo para {documentType} {establishment}-{expeditionPoint} {(seriesName ?? "")}".Trim()
                    );

                try
                {
                    return await ReserveInternalTrackedSeries(s, date);
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (attempt >= 5) throw;
                    await Task.Delay(20 * attempt);

                    // ✅ Limpiar tracking y reintentar (evita estado viejo)
                    _ctx.Entry(s).State = EntityState.Detached;
                }
            }

            throw new Exception("No se pudo reservar numeración fiscal (retry agotado).");
        }

        /// <summary>
        /// ✅ Reserva por ID de talonario (ideal cuando hay 2+ cajas / múltiples series).
        /// </summary>
        public async Task<FiscalNumberReservation> ReserveByIdAsync(int seriesId, DateTime? onDate = null)
        {
            var date = (onDate ?? DateTime.UtcNow).Date;

            for (int attempt = 1; attempt <= 5; attempt++)
            {
                var s = await _ctx.Set<FiscalDocumentSeries>()
                    .FirstOrDefaultAsync(x => x.Id == seriesId);

                if (s == null)
                    throw new Exception($"No existe FiscalDocumentSeries Id={seriesId}.");

                if (!s.IsActive)
                    throw new Exception($"El talonario Id={seriesId} está inactivo.");

                // ✅ vigencia también acá
                if (date < s.ValidFrom.Date || date > s.ValidTo.Date)
                    throw new Exception($"Timbrado fuera de vigencia ({s.ValidFrom:dd/MM/yyyy} - {s.ValidTo:dd/MM/yyyy}).");

                try
                {
                    return await ReserveInternalTrackedSeries(s, date);
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (attempt >= 5) throw;
                    await Task.Delay(20 * attempt);
                    _ctx.Entry(s).State = EntityState.Detached;
                }
            }

            throw new Exception("No se pudo reservar numeración fiscal (retry agotado).");
        }

        private async Task<FiscalNumberReservation> ReserveInternalTrackedSeries(
            FiscalDocumentSeries s,
            DateTime date
        )
        {
            // Vigencia (doble check por seguridad)
            if (date < s.ValidFrom.Date || date > s.ValidTo.Date)
                throw new Exception($"Timbrado fuera de vigencia ({s.ValidFrom:dd/MM/yyyy} - {s.ValidTo:dd/MM/yyyy}).");

            // normalizar NextNumber dentro del rango
            if (s.NextNumber < s.RangeFrom) s.NextNumber = s.RangeFrom;

            if (s.NextNumber > s.RangeTo)
                throw new Exception($"Talonario agotado. NextNumber={s.NextNumber} > RangeTo={s.RangeTo}");

            var numberToUse = s.NextNumber;

            // reservar = incrementar next
            s.NextNumber = s.NextNumber + 1;
            s.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();

            var full = FormatFullNumber(s.Establishment, s.ExpeditionPoint, numberToUse);

            return new FiscalNumberReservation(
                s.Id,
                (s.DocumentType ?? "").Trim().ToUpperInvariant(),
                s.TimbradoNumber,
                s.Establishment,
                s.ExpeditionPoint,
                numberToUse,
                full
            );
        }

        public static string FormatFullNumber(string establishment, string expeditionPoint, int number)
        {
            establishment = (establishment ?? "001").Trim();
            expeditionPoint = (expeditionPoint ?? "001").Trim();
            return $"{establishment}-{expeditionPoint}-{number:D7}";
        }
    }
}
