using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryAccountingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CogsAccountId",
                table: "Categories",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InventoryAccountId",
                table: "Categories",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PurchaseAccountId",
                table: "Categories",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RevenueAccountId",
                table: "Categories",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CogsAccountId",
                table: "Categories",
                column: "CogsAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_InventoryAccountId",
                table: "Categories",
                column: "InventoryAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_PurchaseAccountId",
                table: "Categories",
                column: "PurchaseAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_RevenueAccountId",
                table: "Categories",
                column: "RevenueAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_Accounts_CogsAccountId",
                table: "Categories",
                column: "CogsAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_Accounts_InventoryAccountId",
                table: "Categories",
                column: "InventoryAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_Accounts_PurchaseAccountId",
                table: "Categories",
                column: "PurchaseAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_Accounts_RevenueAccountId",
                table: "Categories",
                column: "RevenueAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Accounts_CogsAccountId",
                table: "Categories");

            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Accounts_InventoryAccountId",
                table: "Categories");

            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Accounts_PurchaseAccountId",
                table: "Categories");

            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Accounts_RevenueAccountId",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Categories_CogsAccountId",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Categories_InventoryAccountId",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Categories_PurchaseAccountId",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Categories_RevenueAccountId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "CogsAccountId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "InventoryAccountId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "PurchaseAccountId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "RevenueAccountId",
                table: "Categories");
        }
    }
}
