import { api } from "@/lib/api";
import type { CreateDirectReceiptPayload, CreateReceiptPayload, PendingDoc, ProductMini, PurchaseOrderOpen, SupplierMini, WarehouseMini } from "./types";

export async function getOpenPurchaseOrders() {
  const res = await api.get<PurchaseOrderOpen[]>("/purchaseorders/open");
  return res.data ?? [];
}

export async function getProductsMini() {
  const res = await api.get<ProductMini[]>("/products");
  return res.data ?? [];
}

export async function getPendingByPurchaseOrder(poId: number) {
  const res = await api.get<PendingDoc>(`/purchaseorders/${poId}/pending`);
  return res.data;
}

export async function createPurchaseReceipt(payload: CreateReceiptPayload) {
  const res = await api.post("/purchasereceipts", payload);
  return res.data;
}

export async function getPurchaseReceiptById(id: number) {
  const res = await api.get(`/purchasereceipts/${id}`);
  return res.data;
}

export async function listPurchaseReceipts() {
  const res = await api.get("/purchasereceipts");
  return res.data ?? [];
}

export async function updatePurchaseReceiptDocuments(id: number, documents: Array<{ type: string; number: string; date?: string | null }>) {
  const res = await api.put(`/purchasereceipts/${id}/documents`, { documents });
  return res.data;
}

export async function getSuppliersMini(): Promise<SupplierMini[]> {
  const res = await api.get<SupplierMini[]>("/sociosnegocio/proveedores");
  if (res.data) return res.data;
  const all = await api.get<any[]>("/sociosnegocio");
  return (all.data ?? []).filter((s: any) => s.partnerType === "S").map((s: any) => ({ id: s.id, razonSocial: s.razonSocial }));
}

export async function getWarehousesMini(): Promise<WarehouseMini[]> {
  const res = await api.get<WarehouseMini[]>("/warehouses");
  return res.data ?? [];
}

export async function createDirectPurchaseReceipt(payload: CreateDirectReceiptPayload) {
  const res = await api.post("/purchasereceipts/direct", payload);
  return res.data;
}

export async function updatePurchaseReceiptPricing(
  id: number,
  lines: Array<{ lineId: number; unitPrice: number; discountPercent: number; taxId?: number | null }>
) {
  const res = await api.put(`/purchasereceipts/${id}/pricing`, { lines });
  return res.data;
}