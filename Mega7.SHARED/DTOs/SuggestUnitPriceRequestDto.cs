using Mega7.SHARED.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    // 1 = Cash, 2 = Credit, 3 = Installments
    public class SuggestUnitPriceRequestDto
    {
        public int ProductId { get; set; }

        // Si viene null, usa parámetros globales
        public int? CustomerId { get; set; }

        public PaymentType PaymentType { get; set; }// 1 cash, 2 credit, 3 installments

        // Solo si PaymentType == 2
        public int? CreditTermId { get; set; }

        // Solo si PaymentType == 3
        public int? InstallmentsCount { get; set; }
        public int? InstallmentIntervalDays { get; set; }

        // Opcional: si querés forzar costo (si el usuario lo edita)
        public decimal? CostOverride { get; set; }
    }
}
