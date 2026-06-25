namespace Mega7.SHARED.Entities
{
    /// <summary>
    /// Pares clave → cuenta contable para la determinación automática de cuentas globales.
    /// Ej: "AR_CLIENTES" → cuenta "Clientes", "VENTAS_GRAVADAS" → cuenta "Ventas Gravadas".
    /// </summary>
    public class AccountingConfig
    {
        public int Id { get; set; }

        /// <summary>Clave única del sistema, ej: "AR_CLIENTES"</summary>
        public string Key { get; set; } = null!;

        /// <summary>Descripción legible para mostrar en la UI</summary>
        public string Label { get; set; } = null!;

        /// <summary>Grupo para agrupar en la página de config (ej: "Ventas", "Compras", "Tesorería")</summary>
        public string Group { get; set; } = "General";

        public int? AccountId { get; set; }
        public Account? Account { get; set; }
    }
}
