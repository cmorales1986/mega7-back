using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class SubCategoryCreateDto
    {
        public string Name { get; set; }
        public bool IsActive { get; set; }
        public int CategoryId { get; set; }
    }
}
