using System.ComponentModel.DataAnnotations;

namespace Mega7.SHARED.Entities
{
    public class Employee
    {
        public int Id { get; set; }

        [MaxLength(100)]
        public string FirstName { get; set; } = "";

        [MaxLength(100)]
        public string LastName { get; set; } = "";

        [MaxLength(30)]
        public string DocumentNumber { get; set; } = ""; // CI

        [MaxLength(100)]
        public string? Position { get; set; } // Cargo

        [MaxLength(100)]
        public string? Department { get; set; } // Departamento

        public decimal BaseSalary { get; set; } = 0;

        public DateTime HireDate { get; set; } = DateTime.UtcNow.Date;

        public DateTime? TerminationDate { get; set; }

        [MaxLength(200)]
        public string? BankName { get; set; }

        [MaxLength(50)]
        public string? BankAccountNumber { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
