using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddARInvoiceLineType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "ARInvoiceLines",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "LineType",
                table: "ARInvoiceLines",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LineType",
                table: "ARInvoiceLines");

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "ARInvoiceLines",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
