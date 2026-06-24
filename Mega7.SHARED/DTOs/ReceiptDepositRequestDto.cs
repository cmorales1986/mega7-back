namespace Mega7.SHARED.DTOs
{
    public class ReceiptDepositRequestDto
    {
        public int BankAccountId { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string? Reference { get; set; }
        public string? Description { get; set; }
        public List<int> ReceiptIds { get; set; } = new();
    }

    public class ReceiptDepositResultDto
    {
        public int BankMovementId { get; set; }
        public decimal Amount { get; set; }
        public int DepositedCount { get; set; }
    }
}
