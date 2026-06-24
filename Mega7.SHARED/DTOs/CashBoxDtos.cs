using System;

namespace Mega7.SHARED.DTOs
{
    public class CashBoxUpsertDto
    {
        public string Name { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    public class CashCategoryUpsertDto
    {
        public string Name { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    public class CashMovementCreateDto
    {
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string Type { get; set; } = "IN"; // IN|OUT|TRANSFER

        public int? CashBoxId { get; set; }      // IN/OUT
        public int? FromCashBoxId { get; set; }  // TRANSFER
        public int? ToCashBoxId { get; set; }    // TRANSFER

        public decimal Amount { get; set; } = 0m;

        public int? CategoryId { get; set; }     // OUT normalmente
        public string Description { get; set; } = "";
        public string Reference { get; set; } = "";
    }

    public class CashSessionOpenDto
    {
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public decimal OpeningBalance { get; set; } = 0m;
    }

    public class CashSessionCloseDto
    {
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public decimal CountedCash { get; set; } = 0m;
        public string Notes { get; set; } = "";
    }

    public class CashBoxBalanceDto
    {
        public int CashBoxId { get; set; }
        public string CashBoxName { get; set; } = "";
        public decimal OpeningBalance { get; set; } = 0m;     // apertura del día (si existe)
        public decimal MovementsNet { get; set; } = 0m;       // neto del día (si filtras por día) o neto acumulado (si lo haces acumulado)
        public decimal CurrentBalance { get; set; } = 0m;
        public DateTime AsOf { get; set; }
        public bool IsActive { get; set; }
        public bool HasOpenSession { get; set; }
        public bool IsClosed { get; set; }
    }
}
