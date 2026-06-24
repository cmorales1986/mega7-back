using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SubCategoryUpdateDto
    {
        public string Name { get; set; } = null!;
        public bool IsActive { get; set; }
        public int CategoryId { get; set; }
    }
}
