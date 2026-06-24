// src/features/inventory/stock-transfer/api.ts
import { api } from "@/lib/api";
import type { Product, Warehouse, StockTransferCreatePayload } from "./types";

export async function getProducts(): Promise<Product[]> {
  const res = await api.get("/Products");
  return res.data ?? [];
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const res = await api.get("/Warehouses");
  return res.data ?? [];
}

export async function getTransferById(id: number) {
  const res = await api.get(`/StockTransfer/${id}`);
  return res.data;
}

export async function createTransfer(payload: StockTransferCreatePayload) {
  await api.post("/StockTransfer", payload);
}

// pickers (ya los usabas en new)
export async function getBatchOptions(productId: number, warehouseId: number) {
  const res = await api.get(
    `/Stock/batches/${productId}?warehouseId=${warehouseId}&onlyAvailable=true`
  );
  return res.data ?? [];
}

export async function getSerialOptions(productId: number, warehouseId: number) {
  const res = await api.get(`/Stock/serials/${productId}?warehouseId=${warehouseId}`);
  return res.data ?? [];
}
