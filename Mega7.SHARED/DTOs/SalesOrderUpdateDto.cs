using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SalesOrderUpdateDto : SalesOrderCreateDto
    {
        public string Status { get; set; } = "DRAFT";
    }
}
