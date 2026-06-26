"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2, PackagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmtPY.format(n);

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

  // ── ui ─────────────────────────────────────────────────────────────────────
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

  // ── submit ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError(null);
    if (!supplierId) return setError("Seleccioná un proveedor.");
    if (!warehouseId) return setError("Seleccioná un depósito.");
    if (lines.length === 0) return setError("Agregá al menos un producto.");
    for (const l of lines) {
      if (!l.productId) return setError("Seleccioná un producto en todas las líneas.");
      if (l.quantity <= 0) return setError("La cantidad debe ser mayor a 0.");
      if (l.isBatch && !l.batchNumber.trim()) return setError(`"${l.productName}" requiere número de lote.`);
      if (l.isSerial && !l.serialNumbers.trim()) return setError(`"${l.productName}" requiere números de serie.`);
    }
    if (attachInvoice && !invoiceNumber.trim()) return setError("Ingresá el número de factura.");

    setSaving(true);
    try {
      await createDirectPurchaseReceipt({
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
      });
      router.push("/purchase-receipts");
    } catch (e: any) {
      setError(e?.response?.data || e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <PageShell
      icon={<PackagePlus className="h-6 w-6 text-emerald-600" />}
      title="Nueva Recepción Directa"
      subtitle="Recepción de inventario sin Orden de Compra previa. Actualiza stock con costo promedio ponderado."
      chips={
        <>
          <Chip tone="neutral">Sin OC</Chip>
          {lines.length > 0 && (
            <Chip tone="info">{lines.length} {lines.length === 1 ? "línea" : "líneas"}</Chip>
          )}
          {totals.total > 0 && (
            <Chip tone="ok">Total: {money(Math.round(totals.total))}</Chip>
          )}
        </>
      }
      right={
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => router.push("/purchase-receipts")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Button
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Guardar Recepción"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Datos generales ─────────────────────────────────────────────── */}
        <Card className="border-slate-200 p-4 shadow-sm">
          <SectionHeader
            icon={<PackagePlus className="h-5 w-5 text-emerald-600" />}
            title="Datos Generales"
            subtitle="Proveedor, depósito y fecha de recepción."
          />
          <Separator className="my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Proveedor *</label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm bg-white"
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
                className="w-full h-10 rounded-md border px-3 text-sm bg-white"
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
              <Input
                type="date"
                className="bg-white"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observaciones</label>
              <Input
                placeholder="Opcional"
                className="bg-white"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* ── Productos ───────────────────────────────────────────────────── */}
        <Card className="border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <SectionHeader
              icon={<PackagePlus className="h-5 w-5 text-emerald-600" />}
              title="Productos"
              subtitle="Agregá cada ítem con cantidad, precio y descuento."
            />
            <Button
              onClick={addLine}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar línea
            </Button>
          </div>

          <Separator className="my-4" />

          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay líneas. Hacé clic en "Agregar línea" para comenzar.
            </p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={line._id}
                  className="rounded-xl border bg-slate-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Línea {idx + 1}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:border-red-300"
                      onClick={() => removeLine(line._id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>

                  {/* Fila principal */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="col-span-2 lg:col-span-2">
                      <label className="block text-xs font-medium mb-1">Producto *</label>
                      <select
                        className="w-full h-9 rounded-md border px-2 text-sm bg-white"
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
                      <Input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        className="bg-white h-9 text-sm"
                        value={line.quantity}
                        onChange={(e) => setLineField(line._id, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Precio unitario</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-white h-9 text-sm"
                        value={line.unitPrice}
                        onChange={(e) => setLineField(line._id, "unitPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Desc %</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="bg-white h-9 text-sm"
                        value={line.discountPercent}
                        onChange={(e) => setLineField(line._id, "discountPercent", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                      <label className="block text-xs font-medium mb-1">Impuesto</label>
                      <select
                        className="w-full h-9 rounded-md border px-2 text-sm bg-white"
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

                  {/* Lote / Serial */}
                  {(line.isBatch || line.isSerial) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200">
                      {line.isBatch && (
                        <>
                          <div>
                            <label className="block text-xs font-medium mb-1">Nro. Lote *</label>
                            <Input
                              className="bg-white h-9 text-sm"
                              value={line.batchNumber}
                              onChange={(e) => setLineField(line._id, "batchNumber", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Vencimiento</label>
                            <Input
                              type="date"
                              className="bg-white h-9 text-sm"
                              value={line.expirationDate}
                              onChange={(e) => setLineField(line._id, "expirationDate", e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {line.isSerial && (
                        <div className={line.isBatch ? "" : "sm:col-span-3"}>
                          <label className="block text-xs font-medium mb-1">
                            Nros. de Serie *{" "}
                            <span className="font-normal text-muted-foreground">(separados por coma)</span>
                          </label>
                          <Input
                            placeholder="SN001, SN002, ..."
                            className="bg-white h-9 text-sm"
                            value={line.serialNumbers}
                            onChange={(e) => setLineField(line._id, "serialNumbers", e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtotal línea */}
                  {line.productId > 0 && (() => {
                    const disc = Math.max(0, Math.min(100, line.discountPercent));
                    const sub  = line.quantity * line.unitPrice * ((100 - disc) / 100);
                    const tax  = taxes.find((t) => t.id === line.taxId);
                    const tot  = sub + sub * ((tax?.rate ?? 0) / 100);
                    return (
                      <div className="text-right text-xs text-muted-foreground pt-1 border-t border-slate-200">
                        Subtotal: <strong>{money(Math.round(sub))}</strong>
                        {" · "}IVA: <strong>{money(Math.round(tot - sub))}</strong>
                        {" · "}Total: <strong className="text-slate-800">{money(Math.round(tot))}</strong>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Barra de totales */}
          {lines.length > 0 && (
            <div className="mt-4 flex justify-end gap-8 rounded-xl bg-slate-100 px-6 py-3 text-sm">
              <span>Subtotal: <strong>{money(Math.round(totals.sub))}</strong></span>
              <span>IVA: <strong>{money(Math.round(totals.tax))}</strong></span>
              <span className="text-base font-bold text-slate-800">
                Total: {money(Math.round(totals.total))}
              </span>
            </div>
          )}
        </Card>

        {/* ── Factura del proveedor ─────────────────────────────────────── */}
        <Card className="border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <input
              id="attach-invoice"
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={attachInvoice}
              onChange={(e) => setAttachInvoice(e.target.checked)}
            />
            <label htmlFor="attach-invoice" className="font-semibold text-sm cursor-pointer select-none">
              Registrar factura del proveedor
            </label>
            <span className="text-xs text-muted-foreground">(opcional — se puede agregar después)</span>
          </div>

          {attachInvoice && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nro. Factura *</label>
                  <Input
                    placeholder="001-001-0000001"
                    className="bg-white"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Factura</label>
                  <Input
                    type="date"
                    className="bg-white"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vencimiento</label>
                  <Input
                    type="date"
                    className="bg-white"
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="is-credit"
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={isCredit}
                      onChange={(e) => setIsCredit(e.target.checked)}
                    />
                    <label htmlFor="is-credit" className="text-sm cursor-pointer select-none">Crédito</label>
                  </div>
                </div>

                {isCredit && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Condición de Crédito</label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm bg-white"
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
            </>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
