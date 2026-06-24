import { api } from "@/lib/api";
import type { CreateReceiptPayload, PendingDoc, ProductMini, PurchaseOrderOpen } from "./types";

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

export async function updatePurchaseReceiptPricing(
  id: number,
  lines: Array<{ lineId: number; unitPrice: number; discountPercent: number; taxId?: number | null }>
) {
  const res = await api.put(`/purchasereceipts/${id}/pricing`, { lines });
  return res.data;
}