using Mega7.API.Data;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Services
{
    /// <summary>
    /// Genera números de documento correlativos de forma atómica usando PostgreSQL UPSERT.
    /// Reemplaza el patrón "leer último → incrementar → guardar" que es susceptible a race conditions.
    /// </summary>
    public class DocNumberService
    {
        private readonly Mega7DbContext _ctx;

        public DocNumberService(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        /// <summary>
        /// Devuelve el siguiente número formateado para el prefijo dado, e.g. "OV000042".
        /// La operación es atómica: usa INSERT ... ON CONFLICT DO UPDATE RETURNING en PostgreSQL.
        /// </summary>
        public async Task<string> NextAsync(string prefix, int digits = 6)
        {
            // UPSERT atómico: inserta con LastNumber=1 o incrementa si ya existe,
            // y devuelve el nuevo valor — todo en una sola operación de BD.
            var rows = await _ctx.Database
                .SqlQueryRaw<int>(
                    """
                    INSERT INTO "DocCounters" ("Prefix", "LastNumber")
                    VALUES ({0}, 1)
                    ON CONFLICT ("Prefix")
                    DO UPDATE SET "LastNumber" = "DocCounters"."LastNumber" + 1
                    RETURNING "LastNumber"
                    """,
                    prefix)
                .ToListAsync();

            return $"{prefix}{rows[0].ToString().PadLeft(digits, '0')}";
        }
    }
}
