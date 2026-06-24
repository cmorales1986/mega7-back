using Microsoft.AspNetCore.Mvc;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Graphics;
using Syncfusion.Drawing; // ✅ PointF está acá
using System.IO;

namespace Mega7.ReportingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        // GET: api/reports/sales-invoice/123/pdf
        [HttpGet("sales-invoice/{id}/pdf")]
        public IActionResult SalesInvoicePdf(int id)
        {
            using var document = new PdfDocument();
            var page = document.Pages.Add();
            var graphics = page.Graphics;

            var fontTitle = new PdfStandardFont(PdfFontFamily.Helvetica, 18, PdfFontStyle.Bold);
            var font = new PdfStandardFont(PdfFontFamily.Helvetica, 12);

            graphics.DrawString("MEGA7 - PDF DUMMY (ReportingService)", fontTitle, PdfBrushes.Black, new PointF(40, 40));
            graphics.DrawString($"InvoiceId recibido: {id}", font, PdfBrushes.Black, new PointF(40, 90));
            graphics.DrawString($"Fecha: {DateTime.Now:yyyy-MM-dd HH:mm:ss}", font, PdfBrushes.Black, new PointF(40, 110));
            graphics.DrawString("Si ves este PDF, el proxy y la API KEY funcionan.", font, PdfBrushes.Black, new PointF(40, 140));

            using var ms = new MemoryStream();
            document.Save(ms);
            var bytes = ms.ToArray();

            return File(bytes, "application/pdf", $"FV_{id}_DUMMY.pdf");
        }
    }
}
