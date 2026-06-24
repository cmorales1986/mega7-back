import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import type { ProductMini, PurchaseOrderOpen, ReceiptDraft } from "./types";
import { getOpenPurchaseOrders, getPendingByPurchaseOrder, getProductsMini, createPurchaseReceipt } from "./api";
import { buildCreatePayload, buildDraftFromPending, validateDraft } from "./mappers";

export function usePurchaseReceiptNew() {
  const [loading, setLoading] = useState(false);

  const [openPOs, setOpenPOs] = useState<PurchaseOrderOpen[]>([]);
  const [products, setProducts] = useState<ProductMini[]>([]);

  const [draft, setDraft] = useState<ReceiptDraft>({
    purchaseOrderId: null,
    receiptDate: new Date().toISOString().slice(0, 10),
    comments: "",

    attachDocs: false,
    deliveryNoteNumber: "",
    deliveryNoteDate: "",
    invoiceNumber: "",
    invoiceDate: "",

    pendingDoc: null,
    lines: [],
  });

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p] as const)), [products]);

  async function refreshLookups() {
    setLoading(true);
    try {
      const [pos, prods] = await Promise.all([getOpenPurchaseOrders(), getProductsMini()]);
      setOpenPOs(pos);
      setProducts(prods);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }

  async function selectPurchaseOrder(poId: number) {
    setLoading(true);
    try {
      const pending = await getPendingByPurchaseOrder(poId);
      setDraft((d) => ({
        ...d,
        purchaseOrderId: poId,
        pendingDoc: pending,
        lines: buildDraftFromPending(pending),
      }));
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar pendientes", "error");
      setDraft((d) => ({ ...d, pendingDoc: null, lines: [] }));
    } finally {
      setLoading(false);
    }
  }

  function setDraftPatch(patch: Partial<ReceiptDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function setLine(poLineId: number, patch: any) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.poLineId === poLineId ? { ...l, ...patch } : l)),
    }));
  }

  async function save(): Promise<{ ok: boolean; error?: string }> {
    const err = validateDraft(draft, products);
    if (err) return { ok: false, error: err };

    setLoading(true);
    try {
      const payload = buildCreatePayload(draft);
      await createPurchaseReceipt(payload);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.response?.data ?? "No se pudo guardar la recepción" };
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshLookups();
  }, []);

  return {
    loading,
    openPOs,
    products,
    productMap,
    draft,
    setDraftPatch,
    setLine,
    refreshLookups,
    selectPurchaseOrder,
    save,
  };
}
