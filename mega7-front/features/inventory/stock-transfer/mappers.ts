// src/features/inventory/stock-transfer/mappers.ts
import type { StockTransferDetailUI } from "./types";

export function mapTransferDetail(x: any, pMap: Record<number, { code: string; name: string }>, fallbackId: number): StockTransferDetailUI {
  const fromName =
    x?.fromWarehouseName ??
    x?.FromWarehouseName ??
    x?.fromWarehouse?.name ??
    x?.FromWarehouse?.Name ??
    "";

  const toName =
    x?.toWarehouseName ??
    x?.ToWarehouseName ??
    x?.toWarehouse?.name ??
    x?.ToWarehouse?.Name ??
    "";

  const rawLines: any[] = x?.lines ?? x?.Lines ?? [];

  const lines = rawLines.map((ln: any, idx: number) => {
    const pid = Number(ln?.productId ?? ln?.ProductId ?? 0);

    const apiCode =
      ln?.productCode ??
      ln?.ProductCode ??
      ln?.product?.code ??
      ln?.Product?.Code ??
      "";

    const apiName =
      ln?.productName ??
      ln?.ProductName ??
      ln?.product?.name ??
      ln?.Product?.Name ??
      "";

    const fb = pMap[pid];

    return {
      id: ln?.id ?? ln?.Id ?? idx + 1,
      productId: pid,
      productCode: (apiCode || fb?.code || "").trim(),
      productName: (apiName || fb?.name || "").trim(),
      quantity: Number(ln?.quantity ?? ln?.Quantity ?? 0),
      batchNumber: ln?.batchNumber ?? ln?.BatchNumber ?? null,
      serialNumbers: ln?.serialNumbers ?? ln?.SerialNumbers ?? null,
    };
  });

  return {
    id: x?.id ?? x?.Id ?? fallbackId,
    transferDate: x?.transferDate ?? x?.TransferDate ?? null,
    fromWarehouseName: fromName,
    toWarehouseName: toName,
    lines,
  };
}
