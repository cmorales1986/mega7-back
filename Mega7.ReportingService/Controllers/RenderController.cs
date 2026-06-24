using BoldReports.Writer;
using BoldReports.Web;                 // ✅ ReportDataSource está aquí
using Microsoft.AspNetCore.Mvc;
using System.IO;

namespace Mega7.ReportingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RenderController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        public RenderController(IWebHostEnvironment env) => _env = env;

        // POST: api/render/sales-invoice/pdf
        [HttpPost("sales-invoice/pdf")]
        public IActionResult RenderSalesInvoicePdf([FromBody] InvoiceRenderRequest req)
        {
            if (req == null) return BadRequest("Body requerido.");
            if (req.Header == null) return BadRequest("Header requerido.");
            req.Lines ??= new();

            var rdlPath = Path.Combine(_env.ContentRootPath, "ReportStore", "Factura.rdl");
            if (!System.IO.File.Exists(rdlPath))
                return NotFound($"No se encontró el RDL en: {rdlPath}");

            using var reportStream = System.IO.File.OpenRead(rdlPath);

            var headerList = new List<InvoiceHeaderDto> { req.Header };

            var writer = new ReportWriter();
            writer.LoadReport(reportStream);

            writer.DataSources.Clear();
            writer.DataSources.Add(new ReportDataSource { Name = "InvoiceHeader", Value = headerList });
            writer.DataSources.Add(new ReportDataSource { Name = "InvoiceLines", Value = req.Lines });

            using var outStream = new MemoryStream();
            writer.Save(outStream, WriterFormat.PDF);

            var fileName = string.IsNullOrWhiteSpace(req.Header.FiscalFullNumber)
                ? "Factura.pdf"
                : $"{req.Header.FiscalFullNumber}.pdf";

            return File(outStream.ToArray(), "application/pdf", fileName);
        }

        // POST: api/render/sales-receipt/pdf
        [HttpPost("sales-receipt/pdf")]
        public IActionResult RenderSalesReceiptPdf([FromBody] ReceiptRenderRequest req)
        {
            if (req == null) return BadRequest("Body requerido.");
            if (req.Header == null) return BadRequest("Header requerido.");
            req.Lines ??= new();

            var rdlPath = Path.Combine(_env.ContentRootPath, "ReportStore", "ReciboVenta.rdl");
            if (!System.IO.File.Exists(rdlPath))
                return NotFound($"No se encontró el RDL en: {rdlPath}");

            using var reportStream = System.IO.File.OpenRead(rdlPath);

            var headerList = new List<ReceiptHeaderDto> { req.Header };

            var writer = new ReportWriter();
            writer.LoadReport(reportStream);

            writer.DataSources.Clear();
            writer.DataSources.Add(new ReportDataSource { Name = "ReceiptHeader", Value = headerList });
            writer.DataSources.Add(new ReportDataSource { Name = "ReceiptLines", Value = req.Lines });

            using var outStream = new MemoryStream();
            writer.Save(outStream, WriterFormat.PDF);

            var fileName = string.IsNullOrWhiteSpace(req.Header.FiscalFullNumber)
                ? "Recibo.pdf"
                : $"{req.Header.FiscalFullNumber}.pdf";

            return File(outStream.ToArray(), "application/pdf", fileName);
        }

    }
}
