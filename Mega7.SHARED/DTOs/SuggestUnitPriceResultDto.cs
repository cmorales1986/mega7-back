using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SuggestUnitPriceResultDto
    {
        public int ProductId { get; set; }
        public decimal CostUsed { get; set; }

        public decimal MarkupPctApplied { get; set; }
        public decimal MarkupAmount { get; set; }

        public decimal UnitPriceSuggested { get; set; }

        public string? RuleInfo { get; set; }
    }
}
