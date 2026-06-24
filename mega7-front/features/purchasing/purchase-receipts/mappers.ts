import type { PendingDoc, ProductMini, ReceiptLineDraft, ReceiptDraft, CreateReceiptPayload } from "./types";
import { splitSerials, toIsoOrNull } from "./utils";

export function buildDraftFromPending(pending: PendingDoc): ReceiptLineDraft[] {
  return (pending.lines ?? []).map((l) => ({
    poLineId: l.id,
    productId: l.productId,
    productName: l.productName,
    pendingQty: Number(l.pendingQty ?? 0),

    quantity: Number(l.pendingQty ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    discountPercent: Number(l.discountPercent ?? 0),
    taxId: l.taxId ?? null,

    batchNumber: "",
    expirationDate: "",
    serialNumbers: "",
  }));
}

export function buildDocuments(draft: ReceiptDraft) {
  if (!draft.attachDocs) return undefined;

  const docs: CreateReceiptPayload["documents"] = [];
  const dn = draft.deliveryNoteNumber.trim();
  if (dn) docs.push({ type: "DELIVERY_NOTE", number: dn, date: toIsoOrNull(draft.deliveryNoteDate) ?? undefined });

  const inv = draft.invoiceNumber.trim();
  if (inv) docs.push({ type: "INVOICE", number: inv, date: toIsoOrNull(draft.invoiceDate) ?? undefined });

  return docs.length ? docs : undefined;
}

export function buildCreatePayload(draft: ReceiptDraft): CreateReceiptPayload {
  const lines = (draft.lines ?? [])
    .filter((l) => Number(l.quantity) > 0)
    .map((l) => ({
      purchaseOrderLineId: l.poLineId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountPercent: Number(l.discountPercent || 0),
      taxId: l.taxId ?? null,
      batchNumber: l.batchNumber?.trim() || null,
      expirationDate: toIsoOrNull(l.expirationDate),
      serialNumbers: l.serialNumbers?.trim() || null,
    }));

  const payload: CreateReceiptPayload = {
    purchaseOrderId: Number(draft.purchaseOrderId),
    receiptDate: new Date(draft.receiptDate).toISOString(),
    comments: draft.comments?.trim() ? draft.comments.trim() : null,
    lines,
  };

  const docs = buildDocuments(draft);
  if (docs) payload.documents = docs;

  return payload;
}

export function validateDraft(draft: ReceiptDraft, products: ProductMini[]): string | null {
  if (!draft.purchaseOrderId) return "Seleccioná una Orden de Compra abierta.";
  if (!draft.pendingDoc) return "No hay pendientes cargados.";
  const used = draft.lines.filter((l) => Number(l.quantity) > 0);
  if (!used.length) return "Debés recepcionar al menos 1 línea (cantidad > 0).";

  if (draft.attachDocs) {
    if (!draft.deliveryNoteNumber.trim() && !draft.invoiceNumber.trim())
      return "Asociar documentos está activo, pero no cargaste N° de remisión ni factura.";
  }

  const pMap = new Map(products.map((p) => [p.id, p] as const));

  for (const l of used) {
    const qty = Number(l.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return `Cantidad inválida en ${l.productName}.`;
    if (qty > l.pendingQty) return `Cantidad excede pendiente en ${l.productName}.`;

    const p = pMap.get(l.productId);
    const isBatch = !!p?.isBatchManaged;
    const isSerial = !!p?.isSerialManaged;

    if (isBatch && !l.batchNumber.trim()) return `El producto ${l.productName} requiere lote.`;

    if (isSerial) {
      if (!Number.isInteger(qty)) return `Serializado: la cantidad debe ser entera en ${l.productName}.`;
      const serials = splitSerials(l.serialNumbers);
      if (!serials.length) return `El producto ${l.productName} requiere seriales.`;
      if (serials.length !== qty) return `Seriales no coinciden con cantidad en ${l.productName}.`;
    }
  }

  return null;
}
