"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { api } from "@/lib/api";
import {
  getSuppliersMini,
  getWarehousesMini,
  createDirectPurchaseReceipt,
} from "@/features/purchasing/purchase-receipts/api";
import type {
  DirectReceiptLineDraft,
  SupplierMini,
  WarehouseMini,
} from "@/features/purchasing/purchase-receipts/types";

type ProductOption = {
  id: number;
  code: string;
  name: string;
  price?: number | null;
  taxId?: number | null;
  isBatchManaged?: boolean;
  isSerialManaged?: boolean;
};

type TaxOption = { id: number; name: string; rate: number };
type CreditTerm = { id: number; name: string; days: number; isActive: boolean };

export default function NewDirectPurchaseReceiptPage() {
  const router = useRouter();

  // ── lookups ────────────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<SupplierMini[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseMini[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [taxes, setTaxes] = useState<TaxOption[]>([]);
  const [creditTerms, setCreditTerms] = useState<CreditTerm[]>([]);

  // ── header fields ──────────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [receiptDate, setReceiptDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [comments, setComments] = useState<string>("");

  // ── lines ──────────────────────────────────────────────────────────────────
  const nextId = useRef(1);
  const [lines, setLines] = useState<DirectReceiptLineDraft[]>([]);

  // ── invoice section ────────────────────────────────────────────────────────
  const [attachInvoice, setAttachInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [creditTermId, setCreditTermId] = useState<number | "">("");

  // ── ui state ───────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getSuppliersMini(),
      getWarehousesMini(),
      api.get<ProductOption[]>("/products"),
      api.get<TaxOption[]>("/taxes"),
      api.get<CreditTerm[]>("/creditterms"),
    ]).then(([sups, whs, prodRes, taxRes, termRes]) => {
      setSuppliers(sups);
      setWarehouses(whs);
      setProducts(prodRes.data ?? []);
      setTaxes((taxRes.data ?? []).filter((t: TaxOption) => t.rate > 0));
      setCreditTerms((termRes.data ?? []).filter((t: CreditTerm) => t.isActive));
    });
  }, []);

  // ── line helpers ───────────────────────────────────────────────────────────
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        _id: nextId.current++,
        productId: 0,
        productName: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        taxId: null,
        batchNumber: "",
        expirationDate: "",
        serialNumbers: "",
        isBatch: false,
        isSerial: false,
      },
    ]);
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l._id !== id));
  }

  function setLineField<K extends keyof DirectReceiptLineDraft>(
    id: number,
    field: K,
    value: DirectReceiptLineDraft[K]
  ) {
    setLines((prev) =>
      prev.map((l) => (l._id === id ? { ...l, [field]: value } : l))
    );
  }

  function handleProductChange(lineId: number, productId: number) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      setLineField(lineId, "productId", 0);
      setLineField(lineId, "productName", "");
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l._id === lineId
          ? {
              ...l,
              productId: prod.id,
              productName: prod.name,
              unitPrice: prod.price ?? 0,
              taxId: prod.taxId ?? null,
              isBatch: !!prod.isBatchManaged,
              isSerial: !!prod.isSerialManaged,
              batchNumber: "",
              expirationDate: "",
              serialNumbers: "",
            }
          : l
      )
    );
  }

  // ── totals ─────────────────────────────────────────────────────────────────
  const totals = lines.reduce(
    (acc, l) => {
      const disc = Math.max(0, Math.min(100, l.discountPercent));
      const sub = l.quantity * l.unitPrice * ((100 - disc) / 100);
      const tax = taxes.find((t) => t.id === l.taxId);
      const taxAmt = sub * ((tax?.rate ?? 0) / 100);
      return { sub: acc.sub + sub, tax: acc.tax + taxAmt, total: acc.total + sub + taxAmt };
    },
    { sub: 0, tax: 0, total: 0 }
  );

  // ── validation & submit ────────────────────────────────────────────────────
  async function handleSave() {
    setError(null);
    if (!supplierId) return setError("Seleccioná un proveedor.");
    if (!warehouseId) return setError("Seleccioná un depósito.");
    if (lines.length === 0) return setError("Agregá al menos un producto.");
    for (const l of lines) {
      if (!l.productId) return setError("Seleccioná un producto en todas las líneas.");
      if (l.quantity <= 0) return setError("La cantidad debe ser mayor a 0.");
      if (l.isBatch && !l.batchNumber.trim()) return setError(`El producto "${l.productName}" requiere número de lote.`);
      if (l.isSerial && !l.serialNumbers.trim()) return setError(`El producto "${l.productName}" requiere números de serie.`);
    }
    if (attachInvoice && !invoiceNumber.trim()) return setError("Ingresá el número de factura.");

    setSaving(true);
    try {
      const payload = {
        supplierId: Number(supplierId),
        warehouseId: Number(warehouseId),
        receiptDate,
        comments: comments || null,
        directLines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          taxId: l.taxId,
          batchNumber: l.batchNumber || null,
          expirationDate: l.expirationDate || null,
          serialNumbers: l.serialNumbers || null,
        })),
        ...(attachInvoice
          ? {
              invoiceNumber: invoiceNumber.trim(),
              invoiceDate: invoiceDate || null,
              invoiceDueDate: invoiceDueDate || null,
              isCredit,
              creditTermId: isCredit && creditTermId ? Number(creditTermId) : null,
            }
          : {}),
      };

      await createDirectPurchaseReceipt(payload);
      router.push("/purchase-receipts");
    } catch (e: any) {
      setError(e?.response?.data || e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva Recepción Directa</h1>
        <span className="text-sm text-muted-foreground">Sin Orden de Compra</span>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Datos Generales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Proveedor *</label>
            <select
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">-- Seleccionar --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.razonSocial}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Depósito *</label>
            <select
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">-- Seleccionar --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha Recepción *</label>
            <input
              type="date"
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observaciones</label>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              placeholder="Opcional"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Lines ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Productos
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={14} /> Agregar línea
          </button>
        </div>

        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay líneas. Hacé clic en "Agregar línea" para comenzar.
          </p>
        )}

        {lines.map((line, idx) => (
          <div key={line._id} className="rounded border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Línea {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeLine(line._id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Row 1: product, qty, price, discount, tax */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                <label className="block text-xs font-medium mb-1">Producto *</label>
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                  value={line.productId || ""}
                  onChange={(e) => handleProductChange(line._id, Number(e.target.value))}
                >
                  <option value="">-- Seleccionar --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} – {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Cantidad *</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                  value={line.quantity}
                  onChange={(e) => setLineField(line._id, "quantity", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Precio unitario</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                  value={line.unitPrice}
                  onChange={(e) => setLineField(line._id, "unitPrice", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Desc %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                  value={line.discountPercent}
                  onChange={(e) => setLineField(line._id, "discountPercent", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Impuesto</label>
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                  value={line.taxId ?? ""}
                  onChange={(e) => setLineField(line._id, "taxId", e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Sin impuesto</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: batch / serial (only shown when relevant) */}
            {(line.isBatch || line.isSerial) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {line.isBatch && (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-1">Nro. Lote *</label>
                      <input
                        type="text"
                        className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                        value={line.batchNumber}
                        onChange={(e) => setLineField(line._id, "batchNumber", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Vencimiento</label>
                      <input
                        type="date"
                        className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                        value={line.expirationDate}
                        onChange={(e) => setLineField(line._id, "expirationDate", e.target.value)}
                      />
                    </div>
                  </>
                )}
                {line.isSerial && (
                  <div className={line.isBatch ? "" : "sm:col-span-2"}>
                    <label className="block text-xs font-medium mb-1">
                      Nros. de Serie * <span className="text-muted-foreground">(separados por coma)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                      placeholder="SN001, SN002, ..."
                      value={line.serialNumbers}
                      onChange={(e) => setLineField(line._id, "serialNumbers", e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Line subtotal */}
            {line.productId > 0 && (
              <div className="text-right text-xs text-muted-foreground">
                {(() => {
                  const disc = Math.max(0, Math.min(100, line.discountPercent));
                  const sub = line.quantity * line.unitPrice * ((100 - disc) / 100);
                  const tax = taxes.find((t) => t.id === line.taxId);
                  const total = sub + sub * ((tax?.rate ?? 0) / 100);
                  return `Subtotal: ${sub.toFixed(2)} + IVA: ${(total - sub).toFixed(2)} = ${total.toFixed(2)}`;
                })()}
              </div>
            )}
          </div>
        ))}

        {/* Totals bar */}
        {lines.length > 0 && (
          <div className="flex justify-end gap-8 pt-2 border-t text-sm">
            <span>Subtotal: <strong>{totals.sub.toFixed(2)}</strong></span>
            <span>IVA: <strong>{totals.tax.toFixed(2)}</strong></span>
            <span className="text-base font-bold">Total: {totals.total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* ── Invoice section ────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <input
            id="attach-invoice"
            type="checkbox"
            className="h-4 w-4"
            checked={attachInvoice}
            onChange={(e) => setAttachInvoice(e.target.checked)}
          />
          <label htmlFor="attach-invoice" className="font-semibold text-sm">
            Registrar factura del proveedor
          </label>
        </div>

        {attachInvoice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nro. Factura *</label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2 text-sm bg-background"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Factura</label>
              <input
                type="date"
                className="w-full rounded border px-3 py-2 text-sm bg-background"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimiento</label>
              <input
                type="date"
                className="w-full rounded border px-3 py-2 text-sm bg-background"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <input
                  id="is-credit"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isCredit}
                  onChange={(e) => setIsCredit(e.target.checked)}
                />
                <label htmlFor="is-credit" className="text-sm">Crédito</label>
              </div>
            </div>

            {isCredit && (
              <div>
                <label className="block text-sm font-medium mb-1">Condición de Crédito</label>
                <select
                  className="w-full rounded border px-3 py-2 text-sm bg-background"
                  value={creditTermId}
                  onChange={(e) => setCreditTermId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">-- Seleccionar --</option>
                  {creditTerms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/purchase-receipts")}
          className="px-4 py-2 rounded border text-sm hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-60"
        >
          <Save size={15} />
          {saving ? "Guardando..." : "Guardar Recepción"}
        </button>
      </div>
    </div>
  );
}
