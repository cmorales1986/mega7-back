namespace Mega7.SHARED.Entities
{
    public class Product
    {
        public int Id { get; set; }

        // Identificación
        public string Code { get; set; } = null!;          // Código interno
        public string Name { get; set; } = null!;          // Nombre comercial
        public string Barcode { get; set; } = "";          // Código de barras opcional

        // Relaciones principales
        public int BrandId { get; set; }
        public Brand? Brand { get; set; }

        public int CategoryId { get; set; }
        public Category? Category { get; set; }

        public int SubCategoryId { get; set; }
        public SubCategory? SubCategory { get; set; }

        public int UnitOfMeasureId { get; set; }
        public UnitOfMeasure? UnitOfMeasure { get; set; }

        public int TaxId { get; set; }
        public Tax? Tax { get; set; }

        // Control de inventario
        public bool IsBatchManaged { get; set; } = false;
        public bool IsSerialManaged { get; set; } = false;

        public decimal MinimumStock { get; set; } = 0;

        // Datos económicos
        public decimal Cost { get; set; } = 0;
        public decimal Price { get; set; } = 0;

        // Imagen, opcional
        public string? ImageUrl { get; set; }

        public bool IsActive { get; set; } = true;

        public string? Description { get; set; }

        // Relaciones de inventario
        public ICollection<Batch>? Batches { get; set; }
        public ICollection<Serial>? Serials { get; set; }
        public ICollection<Stock>? Stocks { get; set; }
    }
}
