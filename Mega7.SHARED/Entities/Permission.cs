namespace Mega7.SHARED.Entities
{
    public class Permission
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;         // "APInvoices.Create"
        public string Module { get; set; } = null!;       // "APInvoices"
        public string Action { get; set; } = null!;       // "Create"
        public string DisplayName { get; set; } = null!;  // "Facturas de Compra: Crear"
        public string Group { get; set; } = null!;        // "Compras"
        public int SortOrder { get; set; }

        public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    }
}
