using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.Entities
{
    public class Tax
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public decimal Rate { get; set; }
    }
}
