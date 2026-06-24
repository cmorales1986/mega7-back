using System;
using System.Collections.Generic;
using Mega7.SHARED.Enums;

namespace Mega7.SHARED.DTOs
{
    public class GenerateSalesOrderPricingOptionsRequestDto
    {
        // Para la opción "Crédito"
        public int? CreditTermId { get; set; }          // ej: 30 días

        // Para la opción "Cuotas"
        public int? MaxInstallmentsCount { get; set; } = 12;
        public int? InstallmentIntervalDays { get; set; } = 30;

        // Si querés regenerar reemplazando opciones previas
        public bool ReplaceExisting { get; set; } = true;
    }

    public class SalesOrderPricingOptionDto
    {
        public int Id { get; set; }
        public PaymentType PaymentType { get; set; }

        public int? CreditTermId { get; set; }
        public string? CreditTermName { get; set; }
        public int? CreditDays { get; set; }

        public int? InstallmentsCount { get; set; }
        public int? InstallmentIntervalDays { get; set; }

        public decimal MarkupPctApplied { get; set; }

        public decimal SubTotal { get; set; }
        public decimal TaxTotal { get; set; }
        public decimal Total { get; set; }

        public string? RuleInfo { get; set; }

        public List<SalesOrderPricingOptionLineDto> Lines { get; set; } = new();
    }

    public class SalesOrderPricingOptionLineDto
    {
        public int SalesOrderLineId { get; set; }
        public int ProductId { get; set; }
        public string ProductCode { get; set; } = "";
        public string ProductName { get; set; } = "";

        public decimal Quantity { get; set; }
        public decimal CostUsed { get; set; }

        public decimal UnitPriceSuggested { get; set; }
        public decimal DiscountPercent { get; set; }

        public int? TaxId { get; set; }
        public decimal TaxRate { get; set; }

        public decimal LineSubTotal { get; set; }
        public decimal LineTax { get; set; }
        public decimal LineTotal { get; set; }
    }

    // Simulador SIN guardar (para usar con el cliente al teléfono)
    public class SimulateSalesOrderPricingOptionsRequestDto
    {
        public int CustomerId { get; set; }
        public int WarehouseId { get; set; }
        public int? CreditTermId { get; set; } // para opción crédito

        public int? MaxInstallmentsCount { get; set; } = 12;
        public int? InstallmentIntervalDays { get; set; } = 30;

        public List<SimulateSalesOrderLineDto> Lines { get; set; } = new();
    }

    public class SimulateSalesOrderLineDto
    {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public decimal DiscountPercent { get; set; }
        public int? TaxId { get; set; }
    }
}
