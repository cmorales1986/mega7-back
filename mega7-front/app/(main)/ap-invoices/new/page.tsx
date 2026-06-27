"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2, ReceiptText, Package, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toErrorMsg } from "@/lib/api-error";

type SupplierMini = { id: number; razonSocial: string };
type WarehouseMini = { id: number; name: string };
type ProductOption = { id: number; code: string; name: string; price?: number | null; taxId?: number | null; isBatchManaged?: boolean; isSerialManaged?: boolean };
type TaxOption     = { id: number; name: string; rate: number };
type CreditTerm    = { id: number; name: string; days: number; isActive: boolean };
type RemisionMini  = { id: number; docNumber: string; supplierName: string };

type LineType = "ITEM" | "SERVICE";

type LineDraft = {
  _id: number;
  lineType: LineType;
  // SERVICE
  description: string;
  // ITEM
  productId: number;
  productName: string;
  warehouseId: number | "";
  batchNumber: string;
  expirationDate: string;
  serialNumbers: string;
  isBatch: boolean;
  isSerial: boolean;
  // comunes
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | null;
};

const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmtPY.format(Math.round(n));

export default function NewAPInvoicePage() {
  const router = useRouter();

  // ── lookups ────────────────────────────────────────────────────────────────
  const [suppliers, setSuppliers]     = useState<SupplierMini[]>([]);
  const [warehouses, setWarehouses]   = useState<WarehouseMini[]>([]);
  const [products, setProducts]       = useState<ProductOption[]>([]);
  const [taxes, setTaxes]             = useState<TaxOption[]>([]);
  const [creditTerms, setCreditTerms] = useState<CreditTerm[]>([]);
  const [remisions, setRemisions]     = useState<RemisionMini[]>([]);

  // ── header ─────────────────────────────────────────────────────────────────
  const [supplierId,    setSupplierId]    = useState<number | "">("");
  const [warehouseId,   setWarehouseId]   = useState<number | "">("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate,   setInvoiceDate]   = useState(new Date().toISOString().slice(0, 10));
  const [dueDate,       setDueDate]       = useState("");
  const [notes,         setNotes]         = useState("");

  // link opcional a documentos base
  const [remisionId,     setRemisionId]     = useState<number | "">("");
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | "">("");

  // ── líneas ─────────────────────────────────────────────────────────────────
  const nextId = useRef(1);
  const [lines, setLines] = useState<LineDraft[]>([]);

  // ── ui ─────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // ── load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<SupplierMini[]>("/sociosnegocio/proveedores").catch(() => api.get("/sociosnegocio")),
      api.get<WarehouseMini[]>("/warehouses"),
      api.get<ProductOption[]>("/products"),
      api.get<TaxOption[]>("/taxes"),
      api.get<CreditTerm[]>("/creditterms"),
      api.get("/purchasereceipts"),
    ]).then(([supRes, whRes, prodRes, taxRes, termRes, remRes]) => {
      const supData = supRes.data ?? [];
      setSuppliers(Array.isArray(supData) ? supData.filter((s: any) => s.partnerType === "S" || s.razonSocial).map((s: any) => ({ id: s.id, razonSocial: s.razonSocial })) : []);
      setWarehouses(whRes.data ?? []);
      setProducts(prodRes.data ?? []);
      setTaxes((taxRes.data ?? []).filter((t: TaxOption) => t.rate > 0));
      setCreditTerms((termRes.data ?? []).filter((t: CreditTerm) => t.isActive));
      const remData = (remRes.data ?? []).filter((r: any) => !r.isCancelled && !r.isInvoiced);
      setRemisions(remData.map((r: any) => ({ id: r.id, docNumber: r.docNumber, supplierName: r.supplierName })));
    });
  }, []);

  // Filtrar remisiones del proveedor seleccionado
  const remisionesProveedor = remisions.filter((r) => {
    if (!supplierId) return true;
    return true; // el backend filtra si fuera necesario; mostramos todas
  });

  // ── helpers de líneas ──────────────────────────────────────────────────────
  function newLine(type: LineType): LineDraft {
    return { _id: nextId.current++, lineType: type, description: "", productId: 0, productName: "", warehouseId: warehouseId || "", batchNumber: "", expirationDate: "", serialNumbers: "", isBatch: false, isSerial: false, quantity: 1, unitPrice: 0, discountPercent: 0, taxId: null };
  }

  function removeLine(id: number) { setLines((p) => p.filter((l) => l._id !== id)); }

  function setLF<K extends keyof LineDraft>(id: number, f: K, v: LineDraft[K]) {
    setLines((p) => p.map((l) => l._id === id ? { ...l, [f]: v } : l));
  }

  function handleProductChange(lineId: number, productId: number) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) { setLF(lineId, "productId", 0); return; }
    setLines((p) => p.map((l) => l._id !== lineId ? l : {
      ...l, productId: prod.id, productName: prod.name, unitPrice: prod.price ?? 0,
      taxId: prod.taxId ?? null, isBatch: !!prod.isBatchManaged, isSerial: !!prod.isSerialManaged,
      batchNumber: "", expirationDate: "", serialNumbers: "",
    }));
  }

  // ── totals ─────────────────────────────────────────────────────────────────
  const totals = lines.reduce((acc, l) => {
    const disc   = Math.max(0, Math.min(100, l.discountPercent));
    const sub    = l.quantity * l.unitPrice * ((100 - disc) / 100);
    const taxObj = taxes.find((t) => t.id === l.taxId);
    const taxAmt = sub * ((taxObj?.rate ?? 0) / 100);
    return { sub: acc.sub + sub, tax: acc.tax + taxAmt, total: acc.total + sub + taxAmt };
  }, { sub: 0, tax: 0, total: 0 });

  // ── submit ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError(null);
    if (!supplierId)     return setError("Seleccioná un proveedor.");
    if (!invoiceNumber.trim()) return setError("Ingresá el número de factura.");
    if (lines.length === 0)    return setError("Agregá al menos una línea.");
    for (const l of lines) {
      if (l.lineType === "SERVICE" && !l.description.trim()) return setError("Todas las líneas de servicio requieren descripción.");
      if (l.lineType === "ITEM" && !l.productId)             return setError("Seleccioná un producto en todas las líneas ITEM.");
      if (l.quantity <= 0) return setError("Cantidad debe ser > 0.");
      if (l.lineType === "ITEM" && !l.warehouseId && !warehouseId) return setError("Especificá un depósito para las líneas ITEM.");
      if (l.lineType === "ITEM" && l.isBatch && !l.batchNumber.trim()) return setError(`"${l.productName}" requiere número de lote.`);
      if (l.lineType === "ITEM" && l.isSerial && !l.serialNumbers.trim()) return setError(`"${l.productName}" requiere números de serie.`);
    }

    setSaving(true);
    try {
      await api.post("/apinvoices", {
        supplierId:       Number(supplierId),
        invoiceNumber:    invoiceNumber.trim(),
        invoiceDate,
        dueDate:          dueDate || null,
        notes:            notes || null,
        purchaseReceiptId: remisionId ? Number(remisionId) : null,
        purchaseOrderId:  purchaseOrderId ? Number(purchaseOrderId) : null,
        warehouseId:      warehouseId ? Number(warehouseId) : null,
        lines: lines.map((l) => ({
          lineType:       l.lineType,
          description:    l.lineType === "SERVICE" ? l.description : null,
          productId:      l.lineType === "ITEM" ? l.productId : null,
          warehouseId:    l.lineType === "ITEM" ? (l.warehouseId ? Number(l.warehouseId) : (warehouseId ? Number(warehouseId) : null)) : null,
          batchNumber:    l.lineType === "ITEM" ? (l.batchNumber || null) : null,
          expirationDate: l.lineType === "ITEM" ? (l.expirationDate || null) : null,
          serialNumbers:  l.lineType === "ITEM" ? (l.serialNumbers || null) : null,
          quantity:       l.quantity,
          unitPrice:      l.unitPrice,
          discountPercent: l.discountPercent,
          taxId:          l.taxId,
        })),
      });
      router.push("/ap-invoices");
    } catch (e: any) {
      setError(toErrorMsg(e, "Error al guardar factura."));
    } finally {
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-emerald-600" />}
      title="Nueva Factura Proveedor"
      subtitle="Factura directa con líneas de inventario (ITEM) y/o servicios (SERVICE)."
      chips={
        <>
          {lines.filter((l) => l.lineType === "ITEM").length > 0 && <Chip tone="ok">{lines.filter((l) => l.lineType === "ITEM").length} ITEM</Chip>}
          {lines.filter((l) => l.lineType === "SERVICE").length > 0 && <Chip tone="info">{lines.filter((l) => l.lineType === "SERVICE").length} SERVICIO</Chip>}
          {totals.total > 0 && <Chip tone="neutral">Total: {money(totals.total)}</Chip>}
        </>
      }
      right={
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => router.push("/ap-invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />{saving ? "Guardando..." : "Guardar Factura"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <Card className="border-slate-200 p-4 shadow-sm">
          <SectionHeader icon={<ReceiptText className="h-5 w-5 text-emerald-600" />} title="Datos de la Factura" subtitle="Proveedor, número y fechas." />
          <Separator className="my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Proveedor *</label>
              <select className="w-full h-10 rounded-md border px-3 text-sm bg-white" value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">-- Seleccionar --</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.razonSocial}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nro. Factura *</label>
              <Input placeholder="001-001-0000001" className="bg-white" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Factura *</label>
              <Input type="date" className="bg-white" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimiento</label>
              <Input type="date" className="bg-white" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Depósito (ITEM)</label>
              <select className="w-full h-10 rounded-md border px-3 text-sm bg-white" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">-- Por línea --</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Observaciones</label>
              <Input placeholder="Opcional" className="bg-white" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Link a Remisión opcional */}
          {remisionesProveedor.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium mb-1">Vincular a Remisión <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <select className="h-10 rounded-md border px-3 text-sm bg-white min-w-64" value={remisionId} onChange={(e) => setRemisionId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Sin remisión</option>
                {remisionesProveedor.map((r) => <option key={r.id} value={r.id}>{r.docNumber} – {r.supplierName}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Si vinculás una remisión, el stock ya fue actualizado por ella.</p>
            </div>
          )}
        </Card>

        {/* ── Líneas ──────────────────────────────────────────────────────── */}
        <Card className="border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <SectionHeader icon={<ReceiptText className="h-5 w-5 text-emerald-600" />} title="Líneas" subtitle="Cada línea puede ser un producto de inventario (ITEM) o un servicio (SERVICE)." />
            <div className="flex gap-2 shrink-0">
              <Button onClick={() => setLines((p) => [...p, newLine("ITEM")])} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <Package className="mr-1 h-4 w-4" /> + ITEM
              </Button>
              <Button onClick={() => setLines((p) => [...p, newLine("SERVICE")])} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Wrench className="mr-1 h-4 w-4" /> + SERVICIO
              </Button>
            </div>
          </div>
          <Separator className="my-4" />

          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay líneas. Usá "+ ITEM" para productos de inventario o "+ SERVICIO" para servicios.</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const isItem = line.lineType === "ITEM";
                const disc   = Math.max(0, Math.min(100, line.discountPercent));
                const sub    = line.quantity * line.unitPrice * ((100 - disc) / 100);
                const taxObj = taxes.find((t) => t.id === line.taxId);
                const tot    = sub + sub * ((taxObj?.rate ?? 0) / 100);

                return (
                  <div key={line._id} className={`rounded-xl border p-4 space-y-3 ${isItem ? "bg-emerald-50/50 border-emerald-200" : "bg-blue-50/50 border-blue-200"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isItem ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>{line.lineType}</span>
                        <span className="text-xs text-muted-foreground">Línea {idx + 1}</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:border-red-300" onClick={() => removeLine(line._id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {isItem ? (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium mb-1">Producto *</label>
                          <select className="w-full h-9 rounded-md border px-2 text-sm bg-white" value={line.productId || ""} onChange={(e) => handleProductChange(line._id, Number(e.target.value))}>
                            <option value="">-- Seleccionar --</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium mb-1">Descripción *</label>
                          <Input className="bg-white h-9 text-sm" value={line.description} onChange={(e) => setLF(line._id, "description", e.target.value)} />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium mb-1">Cantidad *</label>
                        <Input type="number" min="0.0001" step="0.0001" className="bg-white h-9 text-sm" value={line.quantity} onChange={(e) => setLF(line._id, "quantity", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Precio s/IVA</label>
                        <Input type="number" min="0" step="0.01" className="bg-white h-9 text-sm" value={line.unitPrice}
                          onChange={(e) => setLF(line._id, "unitPrice", parseFloat(e.target.value) || 0)} />
                        {(taxObj?.rate ?? 0) > 0 && <div className="text-[11px] text-gray-500 mt-0.5">IVA {taxObj!.rate}%</div>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Precio c/IVA</label>
                        <Input type="number" min="0" step="0.01" className="bg-white h-9 text-sm"
                          value={(taxObj?.rate ?? 0) > 0 ? Math.round(line.unitPrice * (1 + (taxObj!.rate) / 100) * 100) / 100 : line.unitPrice}
                          onChange={(e) => {
                            const withIva = parseFloat(e.target.value) || 0;
                            const r = taxObj?.rate ?? 0;
                            const sinIva = r > 0 ? Math.round(withIva / (1 + r / 100) * 100) / 100 : withIva;
                            setLF(line._id, "unitPrice", sinIva);
                          }} />
                        {(taxObj?.rate ?? 0) > 0 && <div className="text-[11px] text-gray-500 mt-0.5">÷ {(1 + (taxObj!.rate) / 100).toFixed(2)}</div>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Desc %</label>
                        <Input type="number" min="0" max="100" step="0.01" className="bg-white h-9 text-sm" value={line.discountPercent} onChange={(e) => setLF(line._id, "discountPercent", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Impuesto</label>
                        <select className="w-full h-9 rounded-md border px-2 text-sm bg-white" value={line.taxId ?? ""} onChange={(e) => setLF(line._id, "taxId", e.target.value ? Number(e.target.value) : null)}>
                          <option value="">Sin impuesto</option>
                          {taxes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                        </select>
                      </div>
                    </div>

                    {/* ITEM extras: depósito, lote, serial */}
                    {isItem && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-200">
                        <div>
                          <label className="block text-xs font-medium mb-1">Depósito</label>
                          <select className="w-full h-9 rounded-md border px-2 text-sm bg-white" value={line.warehouseId} onChange={(e) => setLF(line._id, "warehouseId", e.target.value ? Number(e.target.value) : "")}>
                            <option value="">{warehouseId ? "(usa header)" : "-- Seleccionar --"}</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                        {line.isBatch && (
                          <>
                            <div>
                              <label className="block text-xs font-medium mb-1">Nro. Lote *</label>
                              <Input className="bg-white h-9 text-sm" value={line.batchNumber} onChange={(e) => setLF(line._id, "batchNumber", e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Vencimiento</label>
                              <Input type="date" className="bg-white h-9 text-sm" value={line.expirationDate} onChange={(e) => setLF(line._id, "expirationDate", e.target.value)} />
                            </div>
                          </>
                        )}
                        {line.isSerial && (
                          <div className={line.isBatch ? "" : "sm:col-span-2"}>
                            <label className="block text-xs font-medium mb-1">Nros. de Serie * <span className="font-normal text-muted-foreground">(coma)</span></label>
                            <Input placeholder="SN001, SN002..." className="bg-white h-9 text-sm" value={line.serialNumbers} onChange={(e) => setLF(line._id, "serialNumbers", e.target.value)} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* subtotal línea */}
                    {(line.productId > 0 || line.description) && (
                      <div className="text-right text-xs text-muted-foreground pt-1 border-t border-slate-200">
                        Sub: <strong>{money(sub)}</strong> · IVA: <strong>{money(tot - sub)}</strong> · Total: <strong className="text-slate-800">{money(tot)}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {lines.length > 0 && (
            <div className="mt-4 flex justify-end gap-8 rounded-xl bg-slate-100 px-6 py-3 text-sm">
              <span>Subtotal: <strong>{money(totals.sub)}</strong></span>
              <span>IVA: <strong>{money(totals.tax)}</strong></span>
              <span className="text-base font-bold text-slate-800">Total: {money(totals.total)}</span>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
