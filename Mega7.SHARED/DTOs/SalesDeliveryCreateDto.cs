using System;
using System.Collections.Generic;

namespace Mega7.SHARED.DTOs
{
    public class SalesDeliveryCreateDto
    {
        // null = modo directo sin OV
        public int? SalesOrderId { get; set; }

        // Requeridos si SalesOrderId es null
        public int? CustomerId  { get; set; }

        public int WarehouseId  { get; set; }

        public DateTime DeliveryDate { get; set; } = DateTime.UtcNow;

        public string? Comments { get; set; }

        public List<SalesDeliveryLineDto> Lines { get; set; } = new();
    }

    public class SalesDeliveryLineDto
    {
        public int? SalesOrderLineId { get; set; }

        public int ProductId { get; set; }

        public decimal Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public decimal DiscountPercent { get; set; } = 0m;

        public int? TaxId { get; set; }

        public string? BatchNumber   { get; set; }

        public string? SerialNumbers { get; set; }
    }
}
