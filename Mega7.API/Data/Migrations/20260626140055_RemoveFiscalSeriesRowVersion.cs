using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveFiscalSeriesRowVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "FiscalDocumentSeries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "FiscalDocumentSeries",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);
        }
    }
}
