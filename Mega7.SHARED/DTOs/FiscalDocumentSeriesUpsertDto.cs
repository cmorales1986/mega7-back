using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class FiscalDocumentSeriesUpsertDto
    {
        public string DocumentType { get; set; } = "FACTURA";
        public string TimbradoNumber { get; set; } = string.Empty;
        public DateTime ValidFrom { get; set; }
        public DateTime ValidTo { get; set; }

        public string Establishment { get; set; } = "001";
        public string ExpeditionPoint { get; set; } = "001";
        public string? SeriesName { get; set; }

        public int RangeFrom { get; set; } = 1;
        public int RangeTo { get; set; } = 99999999;
        public int NextNumber { get; set; } = 1;

        public bool IsActive { get; set; } = true;
        public string? Location { get; set; }
    }

}
