using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountingConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PurchaseAccountId",
                table: "Taxes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SalesAccountId",
                table: "Taxes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "CashBoxes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "BankAccounts",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccountingConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Label = table.Column<string>(type: "text", nullable: false),
                    Group = table.Column<string>(type: "text", nullable: false),
                    AccountId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountingConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountingConfigs_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Taxes_PurchaseAccountId",
                table: "Taxes",
                column: "PurchaseAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Taxes_SalesAccountId",
                table: "Taxes",
                column: "SalesAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_CashBoxes_AccountId",
                table: "CashBoxes",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_AccountId",
                table: "BankAccounts",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_AccountingConfigs_AccountId",
                table: "AccountingConfigs",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_AccountingConfigs_Key",
                table: "AccountingConfigs",
                column: "Key",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Accounts_AccountId",
                table: "BankAccounts",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_CashBoxes_Accounts_AccountId",
                table: "CashBoxes",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Taxes_Accounts_PurchaseAccountId",
                table: "Taxes",
                column: "PurchaseAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Taxes_Accounts_SalesAccountId",
                table: "Taxes",
                column: "SalesAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Accounts_AccountId",
                table: "BankAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_CashBoxes_Accounts_AccountId",
                table: "CashBoxes");

            migrationBuilder.DropForeignKey(
                name: "FK_Taxes_Accounts_PurchaseAccountId",
                table: "Taxes");

            migrationBuilder.DropForeignKey(
                name: "FK_Taxes_Accounts_SalesAccountId",
                table: "Taxes");

            migrationBuilder.DropTable(
                name: "AccountingConfigs");

            migrationBuilder.DropIndex(
                name: "IX_Taxes_PurchaseAccountId",
                table: "Taxes");

            migrationBuilder.DropIndex(
                name: "IX_Taxes_SalesAccountId",
                table: "Taxes");

            migrationBuilder.DropIndex(
                name: "IX_CashBoxes_AccountId",
                table: "CashBoxes");

            migrationBuilder.DropIndex(
                name: "IX_BankAccounts_AccountId",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "PurchaseAccountId",
                table: "Taxes");

            migrationBuilder.DropColumn(
                name: "SalesAccountId",
                table: "Taxes");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "CashBoxes");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "BankAccounts");
        }
    }
}
