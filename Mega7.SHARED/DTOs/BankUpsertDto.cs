namespace Mega7.SHARED.DTOs
{
    public class BankUpsertDto
    {
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    public class BankAccountUpsertDto
    {
        public int BankId { get; set; }
        public string AccountNumber { get; set; } = "";
        public string Alias { get; set; } = "";
        public string Currency { get; set; } = "PYG";
        public decimal InitialBalance { get; set; } = 0m;
        public DateTime InitialBalanceDate { get; set; } = DateTime.UtcNow.Date;
        public bool IsActive { get; set; } = true;
    }

    public class BankMovementCreateDto
    {
        public DateTime Date { get; set; } = DateTime.UtcNow;

        // IN | OUT | TRANSFER
        public string Type { get; set; } = "IN";

        // IN/OUT
        public int? AccountId { get; set; }

        // TRANSFER
        public int? FromAccountId { get; set; }
        public int? ToAccountId { get; set; }

        public decimal Amount { get; set; } = 0m;
        public string Description { get; set; } = "";
        public string Reference { get; set; } = "";
    }
}
