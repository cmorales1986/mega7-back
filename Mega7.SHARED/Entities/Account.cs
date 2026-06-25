using System;
using System.Collections.Generic;

namespace Mega7.SHARED.Entities
{
    public enum AccountType
    {
        Activo = 1,
        Pasivo = 2,
        Patrimonio = 3,
        Ingresos = 4,
        Costos = 5,
        Gastos = 6
    }

    public enum AccountNature
    {
        Deudora = 1,   // saldo normal en el Debe  (activos, costos, gastos)
        Acreedora = 2  // saldo normal en el Haber (pasivos, patrimonio, ingresos)
    }

    public class Account
    {
        public int Id { get; set; }

        /// <summary>Código alfanumérico jerárquico, ej: "1", "1.01", "1.01.001"</summary>
        public string Code { get; set; } = null!;

        public string Name { get; set; } = null!;

        public string? Description { get; set; }

        /// <summary>Nivel en el árbol: 1=raíz … 5=hoja máxima</summary>
        public int Level { get; set; }

        /// <summary>true = cuenta título (no acepta asientos). false = cuenta de movimiento.</summary>
        public bool IsTitle { get; set; }

        public AccountType Type { get; set; }

        public AccountNature Nature { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Árbol auto-referenciado
        public int? ParentId { get; set; }
        public Account? Parent { get; set; }
        public List<Account> Children { get; set; } = new();
    }
}
