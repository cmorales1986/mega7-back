using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class FiscalDocumentSeries
    {
        public int Id { get; set; }

        // FACTURA | NC | ND | REMISION | RECIBO (definimos un set)
        [MaxLength(30)]
        public string DocumentType { get; set; } = "FACTURA";

        // Timbrado
        [MaxLength(30)]
        public string TimbradoNumber { get; set; } = string.Empty;

        public DateTime ValidFrom { get; set; } = DateTime.UtcNow.Date;
        public DateTime ValidTo { get; set; } = DateTime.UtcNow.Date.AddYears(1);

        // Formato Paraguay típico
        [MaxLength(10)]
        public string Establishment { get; set; } = "001";

        [MaxLength(10)]
        public string ExpeditionPoint { get; set; } = "001";

        // opcional: serie/caja/sucursal si querés
        [MaxLength(20)]
        public string? SeriesName { get; set; } // ej: "CAJA1"

        // Rango autorizado
        public int RangeFrom { get; set; } = 1;
        public int RangeTo { get; set; } = 99999999;

        // Próximo número a emitir (correlativo)
        public int NextNumber { get; set; } = 1;

        public bool IsActive { get; set; } = true;

        [MaxLength(200)]
        public string? Location { get; set; } // ej: Asunción, etc.

        // Auditoría
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

    }
}
