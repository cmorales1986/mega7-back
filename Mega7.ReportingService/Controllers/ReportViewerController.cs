using BoldReports.Web.ReportViewer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Mega7.ReportingService.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class ReportViewerController : Controller, IReportController
    {
        private readonly IMemoryCache _cache;
        private readonly IWebHostEnvironment _env;

        public ReportViewerController(IMemoryCache cache, IWebHostEnvironment env)
        {
            _cache = cache;
            _env = env;
        }

        // ✅ POST principal: el Viewer llama esto para render/export/print
        [HttpPost]
        public object PostReportAction([FromBody] Dictionary<string, object> jsonArray)
        {
            return ReportHelper.ProcessReport(jsonArray, this, _cache);
        }

        // ✅ requerido para acciones tipo form post
        [HttpPost]
        public object PostFormReportAction()
        {
            return ReportHelper.ProcessReport(null, this, _cache);
        }

        // ✅ recursos (imágenes embebidas, etc.)
        [ActionName("GetResource")]
        [AcceptVerbs("GET")]
        public object GetResource(ReportResource resource)
        {
            return ReportHelper.GetResource(resource, this, _cache);
        }

        // ✅ acá cargás el RDL como Stream (OBLIGATORIO)
        [NonAction]
        public void OnInitReportOptions(ReportViewerOptions reportOption)
        {
            // reportOption.ReportModel.ReportPath típicamente trae "Factura.rdl" o "Factura"
            // Vos elegís cómo mapearlo. Yo te lo dejo simple:
            var reportName = reportOption.ReportModel.ReportPath;

            if (!reportName.EndsWith(".rdl", StringComparison.OrdinalIgnoreCase) &&
                !reportName.EndsWith(".rdlc", StringComparison.OrdinalIgnoreCase))
            {
                reportName += ".rdl";
            }

            var fullPath = Path.Combine(_env.ContentRootPath, "ReportStore", reportName);

            // abre el reporte como stream
            reportOption.ReportModel.Stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
        }

        [NonAction]
        public void OnReportLoaded(ReportViewerOptions reportOption)
        {
            // acá después vamos a inyectar data sources (ARInvoice, Lines, etc.)
        }
    }
}
