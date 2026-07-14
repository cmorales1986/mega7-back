using System.ComponentModel.DataAnnotations;

namespace Mega7.SHARED.Entities
{
    public class DocCounter
    {
        [Key]
        [MaxLength(20)]
        public string Prefix { get; set; } = string.Empty;

        public int LastNumber { get; set; } = 0;
    }
}
