using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mega7.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class RefactorAPInvoiceUnified : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PurchaseOrderId",
                table: "APInvoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarehouseId",
                table: "APInvoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "APInvoiceLines",
                type: "numeric(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "APInvoiceLines",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AddColumn<string>(
                name: "BatchNumber",
                table: "APInvoiceLines",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountPercent",
                table: "APInvoiceLines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpirationDate",
                table: "APInvoiceLines",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LineType",
                table: "APInvoiceLines",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProductCode",
                table: "APInvoiceLines",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "APInvoiceLines",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductName",
                table: "APInvoiceLines",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SerialNumbers",
                table: "APInvoiceLines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SubTotal",
                table: "APInvoiceLines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "APInvoiceLines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "TaxId",
                table: "APInvoiceLines",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxRate",
                table: "APInvoiceLines",
                type: "numeric(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "WarehouseId",
                table: "APInvoiceLines",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_APInvoices_PurchaseOrderId",
                table: "APInvoices",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_APInvoices_WarehouseId",
                table: "APInvoices",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_APInvoiceLines_ProductId",
                table: "APInvoiceLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_APInvoiceLines_TaxId",
                table: "APInvoiceLines",
                column: "TaxId");

            migrationBuilder.CreateIndex(
                name: "IX_APInvoiceLines_WarehouseId",
                table: "APInvoiceLines",
                column: "WarehouseId");

            migrationBuilder.AddForeignKey(
                name: "FK_APInvoiceLines_Products_ProductId",
                table: "APInvoiceLines",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_APInvoiceLines_Taxes_TaxId",
                table: "APInvoiceLines",
                column: "TaxId",
                principalTable: "Taxes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_APInvoiceLines_Warehouses_WarehouseId",
                table: "APInvoiceLines",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_APInvoices_PurchaseOrders_PurchaseOrderId",
                table: "APInvoices",
                column: "PurchaseOrderId",
                principalTable: "PurchaseOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_APInvoices_Warehouses_WarehouseId",
                table: "APInvoices",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_APInvoiceLines_Products_ProductId",
                table: "APInvoiceLines");

            migrationBuilder.DropForeignKey(
                name: "FK_APInvoiceLines_Taxes_TaxId",
                table: "APInvoiceLines");

            migrationBuilder.DropForeignKey(
                name: "FK_APInvoiceLines_Warehouses_WarehouseId",
                table: "APInvoiceLines");

            migrationBuilder.DropForeignKey(
                name: "FK_APInvoices_PurchaseOrders_PurchaseOrderId",
                table: "APInvoices");

            migrationBuilder.DropForeignKey(
                name: "FK_APInvoices_Warehouses_WarehouseId",
                table: "APInvoices");

            migrationBuilder.DropIndex(
                name: "IX_APInvoices_PurchaseOrderId",
                table: "APInvoices");

            migrationBuilder.DropIndex(
                name: "IX_APInvoices_WarehouseId",
                table: "APInvoices");

            migrationBuilder.DropIndex(
                name: "IX_APInvoiceLines_ProductId",
                table: "APInvoiceLines");

            migrationBuilder.DropIndex(
                name: "IX_APInvoiceLines_TaxId",
                table: "APInvoiceLines");

            migrationBuilder.DropIndex(
                name: "IX_APInvoiceLines_WarehouseId",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderId",
                table: "APInvoices");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "APInvoices");

            migrationBuilder.DropColumn(
                name: "BatchNumber",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "DiscountPercent",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "ExpirationDate",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "LineType",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "ProductCode",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "ProductName",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "SerialNumbers",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "SubTotal",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "TaxId",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "TaxRate",
                table: "APInvoiceLines");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "APInvoiceLines");

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "APInvoiceLines",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "APInvoiceLines",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);
        }
    }
}
