using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Mega7.SHARED.DTOs
{
    public class ProductBatchSerialDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public bool IsBatchManaged { get; set; }
        public bool IsSerialManaged { get; set; }
        public bool IsActive { get; set; }
    }
}
