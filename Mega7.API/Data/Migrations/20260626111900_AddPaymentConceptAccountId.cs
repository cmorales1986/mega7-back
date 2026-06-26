using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentConceptAccountId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "PaymentConcepts",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentConcepts_AccountId",
                table: "PaymentConcepts",
                column: "AccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_PaymentConcepts_Accounts_AccountId",
                table: "PaymentConcepts",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PaymentConcepts_Accounts_AccountId",
                table: "PaymentConcepts");

            migrationBuilder.DropIndex(
                name: "IX_PaymentConcepts_AccountId",
                table: "PaymentConcepts");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "PaymentConcepts");
        }
    }
}
