namespace Mega7.SHARED.Entities
{
    public class RolePermission
    {
        public int Id { get; set; }
        public string RoleName { get; set; } = null!;
        public int PermissionId { get; set; }

        public Permission Permission { get; set; } = null!;
    }
}
