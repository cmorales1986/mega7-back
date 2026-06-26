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
    [Route("api/employees")]
    public class EmployeesController : ControllerBase
    {
        private readonly Mega7DbContext _ctx;

        public EmployeesController(Mega7DbContext ctx) => _ctx = ctx;

        [RequirePermission(Perms.EmployeesView)]
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool onlyActive = false)
        {
            var q = _ctx.Employees.AsNoTracking().AsQueryable();
            if (onlyActive) q = q.Where(e => e.IsActive);
            var list = await q.OrderBy(e => e.LastName).ThenBy(e => e.FirstName).ToListAsync();
            return Ok(list);
        }

        [RequirePermission(Perms.EmployeesView)]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var e = await _ctx.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound();
            return Ok(e);
        }

        [RequirePermission(Perms.EmployeesCreate)]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] EmployeeUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.FirstName)) return BadRequest("El nombre es requerido.");
            if (string.IsNullOrWhiteSpace(dto.LastName))  return BadRequest("El apellido es requerido.");

            var emp = new Employee
            {
                FirstName         = dto.FirstName.Trim(),
                LastName          = dto.LastName.Trim(),
                DocumentNumber    = (dto.DocumentNumber ?? "").Trim(),
                Position          = dto.Position?.Trim(),
                Department        = dto.Department?.Trim(),
                BaseSalary        = dto.BaseSalary,
                HireDate          = dto.HireDate.Date,
                TerminationDate   = dto.TerminationDate?.Date,
                BankName          = dto.BankName?.Trim(),
                BankAccountNumber = dto.BankAccountNumber?.Trim(),
                Notes             = dto.Notes?.Trim(),
                IsActive          = dto.IsActive,
            };

            _ctx.Employees.Add(emp);
            await _ctx.SaveChangesAsync();
            return Ok(emp);
        }

        [RequirePermission(Perms.EmployeesEdit)]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] EmployeeUpsertDto dto)
        {
            var emp = await _ctx.Employees.FindAsync(id);
            if (emp == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.FirstName)) return BadRequest("El nombre es requerido.");
            if (string.IsNullOrWhiteSpace(dto.LastName))  return BadRequest("El apellido es requerido.");

            emp.FirstName         = dto.FirstName.Trim();
            emp.LastName          = dto.LastName.Trim();
            emp.DocumentNumber    = (dto.DocumentNumber ?? "").Trim();
            emp.Position          = dto.Position?.Trim();
            emp.Department        = dto.Department?.Trim();
            emp.BaseSalary        = dto.BaseSalary;
            emp.HireDate          = dto.HireDate.Date;
            emp.TerminationDate   = dto.TerminationDate?.Date;
            emp.BankName          = dto.BankName?.Trim();
            emp.BankAccountNumber = dto.BankAccountNumber?.Trim();
            emp.Notes             = dto.Notes?.Trim();
            emp.IsActive          = dto.IsActive;
            emp.UpdatedAt         = DateTime.UtcNow;

            await _ctx.SaveChangesAsync();
            return Ok(emp);
        }

        [RequirePermission(Perms.EmployeesDelete)]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var emp = await _ctx.Employees.FindAsync(id);
            if (emp == null) return NotFound();

            _ctx.Employees.Remove(emp);
            await _ctx.SaveChangesAsync();
            return NoContent();
        }
    }

    public class EmployeeUpsertDto
    {
        public string  FirstName         { get; set; } = "";
        public string  LastName          { get; set; } = "";
        public string? DocumentNumber    { get; set; }
        public string? Position          { get; set; }
        public string? Department        { get; set; }
        public decimal BaseSalary        { get; set; }
        public DateTime HireDate         { get; set; } = DateTime.UtcNow;
        public DateTime? TerminationDate { get; set; }
        public string? BankName          { get; set; }
        public string? BankAccountNumber { get; set; }
        public string? Notes             { get; set; }
        public bool    IsActive          { get; set; } = true;
    }
}
