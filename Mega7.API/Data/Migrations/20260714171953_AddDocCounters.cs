using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDocCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DocCounters",
                columns: table => new
                {
                    Prefix = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LastNumber = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocCounters", x => x.Prefix);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocCounters");
        }
    }
}
