using Mega7.API.Attributes;
using Mega7.API.Data;
using Mega7.API.Utils;
using Mega7.SHARED.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Mega7.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SociosNegocioController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public SociosNegocioController(Mega7DbContext ctx)
        {
            _ctx = ctx;
        }

        // GET: api/sociosnegocio
        [RequirePermission(Perms.SociosView)]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _ctx.SociosNegocio
                .Include(x => x.CreditTerm)
                .Include(x => x.Sucursales)
                .OrderBy(x => x.RazonSocial)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/sociosnegocio/5
        [RequirePermission(Perms.SociosView)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var socio = await _ctx.SociosNegocio
                .Include(x => x.CreditTerm)
                .Include(x => x.Sucursales)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (socio == null)
                return NotFound();

            return Ok(socio);
        }

        [RequirePermission(Perms.SociosCreate)]
        [HttpPost]
        public async Task<IActionResult> Create(SocioNegocio model)
        {
            model.Code = await GeneratePartnerCode(model.PartnerType);

            // VALIDACIONES
            if (await _ctx.SociosNegocio.AnyAsync(s => s.RUC == model.RUC))
                return BadRequest("El RUC ya está registrado.");

            if (await _ctx.SociosNegocio.AnyAsync(s => s.Code == model.Code))
                return BadRequest("El código ya está registrado.");

            if (model.AllowInstallments)
            {
                if (!model.MaxInstallments.HasValue || model.MaxInstallments.Value < 2)
                    return BadRequest("MaxInstallments debe ser >= 2 si AllowInstallments está activo.");

                if (!model.DefaultInstallments.HasValue || model.DefaultInstallments.Value < 1)
                    return BadRequest("DefaultInstallments debe ser >= 1.");

                if (model.DefaultInstallments.Value > model.MaxInstallments.Value)
                    return BadRequest("DefaultInstallments no puede ser mayor a MaxInstallments.");
            }
            else
            {
                model.MaxInstallments = null;
                model.DefaultInstallments = null;
            }

            _ctx.SociosNegocio.Add(model);
            await _ctx.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        [RequirePermission(Perms.SociosEdit)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, SocioNegocio model)
        {
            var socio = await _ctx.SociosNegocio.FindAsync(id);

            if (socio == null)
                return NotFound();

            // VALIDACIONES
            if (await _ctx.SociosNegocio.AnyAsync(s => s.RUC == model.RUC && s.Id != id))
                return BadRequest("El RUC ya está registrado.");

            if (await _ctx.SociosNegocio.AnyAsync(s => s.Code == model.Code && s.Id != id))
                return BadRequest("El código ya está registrado.");

            if (model.AllowInstallments)
            {
                if (!model.MaxInstallments.HasValue || model.MaxInstallments.Value < 2)
                    return BadRequest("MaxInstallments debe ser >= 2 si AllowInstallments está activo.");

                if (!model.DefaultInstallments.HasValue || model.DefaultInstallments.Value < 1)
                    return BadRequest("DefaultInstallments debe ser >= 1.");

                if (model.DefaultInstallments.Value > model.MaxInstallments.Value)
                    return BadRequest("DefaultInstallments no puede ser mayor a MaxInstallments.");
            }
            else
            {
                model.MaxInstallments = null;
                model.DefaultInstallments = null;
            }

            socio.PartnerType = model.PartnerType;
            //socio.Code = model.Code;
            socio.RazonSocial = model.RazonSocial;
            socio.RUC = model.RUC;
            socio.Contacto = model.Contacto;
            socio.Email = model.Email;
            socio.Telefono = model.Telefono;
            socio.Direccion = model.Direccion;
            socio.Ciudad = model.Ciudad;
            socio.IsActive = model.IsActive;

            socio.CreditTermId = model.CreditTermId;
            socio.CreditLimit = model.CreditLimit;

            socio.AllowInstallments = model.AllowInstallments;
            socio.MaxInstallments = model.MaxInstallments;
            socio.DefaultInstallments = model.DefaultInstallments;

            socio.UpdatedAt = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        [RequirePermission(Perms.SociosDelete)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var socio = await _ctx.SociosNegocio.FindAsync(id);
            if (socio == null)
                return NotFound();

            bool tieneMovimientos = await _ctx.StockEntries.AnyAsync(x => x.SupplierName == socio.RazonSocial);
            // Más adelante se agregan consultas a ventas, pagos, etc.

            if (tieneMovimientos)
                return BadRequest("No se puede eliminar: el socio tiene movimientos. Desactívelo en su lugar.");

            _ctx.SociosNegocio.Remove(socio);
            await _ctx.SaveChangesAsync();

            return NoContent();
        }

        [RequirePermission(Perms.SociosView)]
        [HttpGet("proveedores")]
        public async Task<IActionResult> GetSuppliers()
        {
            var suppliers = await _ctx.SociosNegocio
                .Where(s => s.PartnerType == "S")
                .OrderBy(s => s.RazonSocial)
                .ToListAsync();

            return Ok(suppliers);
        }

        [RequirePermission(Perms.SociosView)]
        [HttpGet("clientes")]
        public async Task<IActionResult> GetCustomers()
        {
            var customers = await _ctx.SociosNegocio
                .Where(s => s.PartnerType == "C")
                .OrderBy(s => s.RazonSocial)
                .ToListAsync();

            return Ok(customers);
        }

        [RequirePermission(Perms.SociosView)]
        [HttpGet("buscar-ruc/{ruc}")]
        public async Task<IActionResult> GetByRUC(string ruc)
        {
            var socio = await _ctx.SociosNegocio.FirstOrDefaultAsync(s => s.RUC == ruc);
            if (socio == null) return NotFound();
            return Ok(socio);
        }

        [RequirePermission(Perms.SociosView)]
        [HttpGet("buscar/{texto}")]
        public async Task<IActionResult> Search(string texto)
        {
            var list = await _ctx.SociosNegocio
                .Where(s => s.RazonSocial.Contains(texto) || s.Code.Contains(texto))
                .ToListAsync();

            return Ok(list);
        }

        [RequirePermission(Perms.SociosEdit)]
        [HttpPost("{id}/sucursales")]
        public async Task<IActionResult> AddSucursal(int id, SocioNegocioSucursal model)
        {
            var socio = await _ctx.SociosNegocio.FindAsync(id);
            if (socio == null)
                return NotFound();

            model.SocioNegocioId = id;

            _ctx.SocioNegocioSucursales.Add(model);
            await _ctx.SaveChangesAsync();

            return Ok(model);
        }


        private async Task<string> GeneratePartnerCode(string partnerType)
        {
            string prefix = partnerType.ToUpper() switch
            {
                "C" => "C",  // Clientes
                "S" => "P",  // Proveedores (o “S”, lo que prefieras)
                _ => "X"   // Otros (opcional)
            };

            // Buscar último código generado
            var lastCode = await _ctx.SociosNegocio
                .Where(s => s.PartnerType == partnerType)
                .OrderByDescending(s => s.Code)
                .Select(s => s.Code)
                .FirstOrDefaultAsync();

            if (lastCode == null)
            {
                return prefix + "0001";
            }

            // Ej: C0012 → extraer número → 12
            var numberPart = lastCode.Substring(1);
            int number = int.Parse(numberPart);

            // Aumentar
            number++;

            // Devolver con relleno: C0013
            return prefix + number.ToString("D4");
        }




    }

}
