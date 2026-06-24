public class InvoiceHeaderDto
{
    public string CompanyName { get; set; } = "MEGA 7 E.A.S.";
    public string DocTitle { get; set; } = "FACTURA VENTA";
    public string FiscalFullNumber { get; set; } = "";
    public string Timbrado { get; set; } = "";
    public DateTime InvoiceDate { get; set; }
    public DateTime DueDate { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerRuc { get; set; } = "";
    public decimal SubTotal { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal Total { get; set; }
    public string? Comments { get; set; }
}

public class InvoiceLineDto
{
    public int LineNum { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal LineTotal { get; set; }
    public string? BatchNumber { get; set; }
    public string? SerialNumbers { get; set; }
}

public class InvoiceRenderRequest
{
    public InvoiceHeaderDto Header { get; set; } = new();
    public List<InvoiceLineDto> Lines { get; set; } = new();
}

public class ReceiptHeaderDto
{
    public string CompanyName { get; set; } = "MEGA 7 E.A.S.";
    public string DocTitle { get; set; } = "RECIBO DE VENTA";
    public string FiscalFullNumber { get; set; } = "";
    public string Timbrado { get; set; } = "";
    public DateTime ReceiptDate { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerRuc { get; set; } = "";
    public string PaymentMethod { get; set; } = "";
    public string PaymentReference { get; set; } = "";
    public decimal TotalReceived { get; set; }
    public string? Notes { get; set; }
}

public class ReceiptLineDto
{
    public int LineNum { get; set; }
    public string InvoiceNumber { get; set; } = "";
    public DateTime? InvoiceDate { get; set; }
    public decimal InvoiceTotal { get; set; }
    public decimal InvoiceBalance { get; set; }
    public decimal AppliedAmount { get; set; }
}

public class ReceiptRenderRequest
{
    public ReceiptHeaderDto Header { get; set; } = new();
    public List<ReceiptLineDto> Lines { get; set; } = new();
}

