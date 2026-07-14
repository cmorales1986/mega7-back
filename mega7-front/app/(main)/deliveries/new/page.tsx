"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Save, Boxes, Barcode, Truck, ShoppingCart, CalendarDays,
  ListChecks, Building2, MessageSquare, Plus, Trash2, User2,
  RefreshCcw,
} from "lucide-react";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { toErrorMsg } from "@/lib/api-error";

// ─── Types ────────────────────────────────────────────────────────────────────

type SalesOrderOpen = {
  id: number; docNumber: string; orderDate: string;
  customerId: number; customerName: string;
  warehouseId: number; warehouseName?: string | null; status: string;
};

type PendingLine = {
  id: number; productId: number; productCode: string; productName: string;
  orderedQty: number; invoicedQty: number; pendingQty: number;
  unitPrice: number; discountPercent: number; taxId: number | null; taxRate: number;
};

type PendingDoc = {
  id: number; docNumber: string; orderDate: string;
  customerId: number; customerName: string;
  warehouseId: number; warehouseName?: string | null; lines: PendingLine[];
};

type Product = {
  id: number; code: string; name: string; price?: number | null;
  taxId?: number | null; isBatchManaged?: boolean; isSerialManaged?: boolean;
};

type Customer  = { id: number; razonSocial: string };
type Warehouse = { id: number; name: string };
type TaxMini   = { id: number; rate: number };

type BatchPickDto  = { id: number; productId: number; warehouseId: number; batchNumber: string; quantity: number };
type SerialPickDto = { id: number; productId: number; warehouseId: number; serialNumber: string; isActive?: boolean };

// Lines for SO mode
type SOLineDraft = {
  soLineId: number; productId: number; productCode: string; productName: string;
  pendingQty: number; quantity: number; unitPrice: number; discountPercent: number;
  taxId: number | null; batchNumber: string; serialNumbers: string;
};

// Lines for direct mode
type DirectLineDraft = {
  id: number; productId: number | null; quantity: number;
  unitPrice: number; discountPercent: number; taxId: number | null;
  batchNumber: string; serialNumbers: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPY        = new Intl.NumberFormat("es-PY");
const money        = (n: any) => fmtPY.format(Number(n || 0));
const round2       = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const parseSerials = (s: string) => (s ?? "").split(/[\n,;]+/g).map((x) => x.trim()).filter(Boolean);
const isIntLike    = (n: number) => Number.isFinite(n) && Math.trunc(n) === n;

const onlyDigits   = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtMoneyInput = (s: string) => { const d = onlyDigits(s); return d ? fmtPY.format(Number(d)) : ""; };
const moneyToNumber = (s: string) => { const d = onlyDigits(s); return d ? Number(d) : 0; };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewDeliveryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Lookups
  const [openSOs,    setOpenSOs]    = useState<SalesOrderOpen[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [taxes,      setTaxes]      = useState<TaxMini[]>([]);

  // Mode
  const [mode, setMode] = useState<"so" | "direct">("so");

  // SO mode
  const [soId,       setSoId]       = useState<number | "">("");
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);
  const [soLines,    setSoLines]    = useState<SOLineDraft[]>([]);

  // Direct mode
  const [directCustomerId,  setDirectCustomerId]  = useState<number | null>(null);
  const [directWarehouseId, setDirectWarehouseId] = useState<number | null>(null);
  const [directLines,       setDirectLines]       = useState<DirectLineDraft[]>([]);
  const nextDId = useRef(1);

  // Header
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comments,     setComments]     = useState("");

  // Tracking dialog
  const [trackOpen,       setTrackOpen]       = useState(false);
  const [trackLineId,     setTrackLineId]     = useState<number | null>(null);
  const [trackMode,       setTrackMode]       = useState<"so" | "direct">("so");
  const [batchOptions,    setBatchOptions]    = useState<BatchPickDto[]>([]);
  const [serialOptions,   setSerialOptions]   = useState<SerialPickDto[]>([]);
  const [openSerialPick,  setOpenSerialPick]  = useState(false);
  const [serialSearch,    setSerialSearch]    = useState("");
  const [selSerials,      setSelSerials]      = useState<string[]>([]);

  // ─── Load lookups ──────────────────────────────────────────────────────────
  const loadLookups = async () => {
    try {
      const getCust = async () => {
        try { return await api.get("/sociosnegocio/clientes"); }
        catch {
          const r = await api.get("/sociosnegocio");
          return { data: (r.data ?? []).filter((c: any) => (c.partnerType ?? "").toUpperCase() === "C") };
        }
      };
      const [soRes, prodRes, whRes, custRes, taxRes] = await Promise.all([
        api.get("/salesorders/open"),
        api.get("/products"),
        api.get("/warehouses"),
        getCust(),
        api.get("/taxes"),
      ]);
      setOpenSOs(soRes.data ?? []);
      setProducts(prodRes.data ?? []);
      setWarehouses(whRes.data ?? []);
      setCustomers(custRes.data ?? []);
      setTaxes((taxRes.data ?? []).map((t: any) => ({ id: t.id, rate: Number(t.rate ?? 0) })));
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar datos"), "error");
    }
  };

  useEffect(() => { loadLookups(); }, []);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const taxMap     = useMemo(() => new Map(taxes.map((t) => [t.id, t.rate])), [taxes]);
  const withIva    = (price: number, taxId: number | null) => { const r = taxId ? (taxMap.get(taxId) ?? 0) : 0; return r > 0 ? Math.round(price * (1 + r / 100) * 100) / 100 : price; };
  const sinIva     = (priceWithIva: number, taxId: number | null) => { const r = taxId ? (taxMap.get(taxId) ?? 0) : 0; return r > 0 ? Math.round(priceWithIva / (1 + r / 100) * 100) / 100 : priceWithIva; };
  const taxRate    = (taxId: number | null) => taxId ? (taxMap.get(taxId) ?? 0) : 0;

  // ─── SO pending load ───────────────────────────────────────────────────────
  const loadPending = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/salesorders/${id}/pending`);
      const doc: PendingDoc = res.data;
      setPendingDoc(doc);
      setSoLines((doc.lines ?? []).map((l) => ({
        soLineId:        l.id,
        productId:       l.productId,
        productCode:     l.productCode,
        productName:     l.productName,
        pendingQty:      Number(l.pendingQty ?? 0),
        quantity:        Number(l.pendingQty ?? 0),
        unitPrice:       Number(l.unitPrice ?? 0),
        discountPercent: Number(l.discountPercent ?? 0),
        taxId:           l.taxId ?? null,
        batchNumber:     "",
        serialNumbers:   "",
      })));
    } catch (e: any) {
      setPendingDoc(null); setSoLines([]);
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar pendientes"), "error");
    } finally { setLoading(false); }
  };

  // ─── Line mutators ─────────────────────────────────────────────────────────
  const setSOLine  = (soLineId: number, patch: Partial<SOLineDraft>)     => setSoLines((p) => p.map((l) => l.soLineId === soLineId ? { ...l, ...patch } : l));
  const setDirLine = (id: number, patch: Partial<DirectLineDraft>)       => setDirectLines((p) => p.map((l) => l.id === id      ? { ...l, ...patch } : l));
  const addDirLine = () => { const id = nextDId.current++; setDirectLines((p) => [...p, { id, productId: null, quantity: 1, unitPrice: 0, discountPercent: 0, taxId: null, batchNumber: "", serialNumbers: "" }]); };
  const remDirLine = (id: number) => setDirectLines((p) => p.filter((l) => l.id !== id));

  // Tracking dialog helpers
  const soTrack  = soLines.find((x) => x.soLineId === trackLineId) ?? null;
  const dirTrack = directLines.find((x) => x.id === trackLineId) ?? null;
  const diagProd = trackMode === "so" ? soTrack?.productId ?? null  : dirTrack?.productId ?? null;
  const diagQty  = trackMode === "so" ? soTrack?.quantity  ?? 0     : dirTrack?.quantity  ?? 0;
  const diagBatch = trackMode === "so" ? soTrack?.batchNumber   ?? "" : dirTrack?.batchNumber   ?? "";
  const diagSer   = trackMode === "so" ? soTrack?.serialNumbers ?? "" : dirTrack?.serialNumbers ?? "";
  const diagName  = trackMode === "so" ? soTrack?.productName ?? ""  : (diagProd ? (productMap.get(diagProd)?.name ?? "") : "");
  const isBatchDlg  = !!diagProd && !!productMap.get(diagProd)?.isBatchManaged;
  const isSerialDlg = !!diagProd && !!productMap.get(diagProd)?.isSerialManaged;
  const setDlgLine  = (patch: any) => {
    if (trackMode === "so"     && soTrack)  setSOLine(soTrack.soLineId, patch);
    if (trackMode === "direct" && dirTrack) setDirLine(dirTrack.id,     patch);
  };

  const openTrack = async (lineId: number, tm: "so" | "direct") => {
    setTrackMode(tm); setTrackLineId(lineId);
    let productId: number; let whId: number;
    if (tm === "so") {
      const l = soLines.find((x) => x.soLineId === lineId);
      if (!l || !pendingDoc) { setTrackOpen(true); return; }
      productId = l.productId; whId = Number(pendingDoc.warehouseId);
      setSelSerials(parseSerials(l.serialNumbers));
    } else {
      const l = directLines.find((x) => x.id === lineId);
      if (!l || !l.productId || !directWarehouseId) {
        Swal.fire("Aviso", "Seleccioná producto y depósito antes de usar Tracking.", "warning"); return;
      }
      productId = l.productId; whId = directWarehouseId;
      setSelSerials(parseSerials(l.serialNumbers));
    }
    setBatchOptions([]); setSerialOptions([]); setSerialSearch("");
    const p = productMap.get(productId);
    try {
      if (p?.isBatchManaged)  { const r = await api.get(`/stock/batches/${productId}?warehouseId=${whId}&onlyAvailable=true`);  setBatchOptions(r.data ?? []); }
      if (p?.isSerialManaged) { const r = await api.get(`/stock/serials/${productId}?warehouseId=${whId}`); setSerialOptions(r.data ?? []); }
    } catch { Swal.fire("Aviso", "No se pudo cargar lotes/seriales.", "warning"); }
    setTrackOpen(true);
  };

  // ─── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const src = mode === "direct"
      ? directLines.map((l) => ({ q: l.quantity, p: l.unitPrice, d: l.discountPercent }))
      : soLines.map((l) => ({ q: l.quantity, p: l.unitPrice, d: l.discountPercent }));
    let sub = 0;
    for (const l of src) { if (l.q > 0) sub += round2(l.q * (l.p || 0) * ((100 - (l.d || 0)) / 100)); }
    return round2(sub);
  }, [soLines, directLines, mode]);

  // ─── Validate ──────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (mode === "so") {
      if (!soId || !pendingDoc) return "Seleccioná una OV abierta.";
      const used = soLines.filter((l) => l.quantity > 0);
      if (!used.length) return "Debés entregar al menos 1 línea (cantidad > 0).";
      for (const l of used) {
        if (l.quantity > l.pendingQty) return `Excede pendiente en ${l.productName}.`;
        const p = productMap.get(l.productId);
        if (p?.isBatchManaged && !l.batchNumber?.trim()) return `${l.productName} requiere lote.`;
        if (p?.isSerialManaged) {
          if (!isIntLike(l.quantity)) return `${l.productName}: cantidad debe ser entera.`;
          const s = parseSerials(l.serialNumbers);
          if (!s.length) return `${l.productName} requiere seriales.`;
          if (s.length !== Math.trunc(l.quantity)) return `Seriales no coinciden en ${l.productName}.`;
        }
      }
    } else {
      if (!directCustomerId)  return "Seleccioná el cliente.";
      if (!directWarehouseId) return "Seleccioná el depósito.";
      const used = directLines.filter((l) => l.productId && l.quantity > 0);
      if (!used.length) return "Añadí al menos una línea con producto.";
      for (const l of used) {
        const p = productMap.get(l.productId!);
        if (p?.isBatchManaged && !l.batchNumber?.trim()) return `${p.name} requiere lote.`;
        if (p?.isSerialManaged) {
          if (!isIntLike(l.quantity)) return `${p.name}: cantidad debe ser entera.`;
          const s = parseSerials(l.serialNumbers);
          if (!s.length) return `${p.name} requiere seriales.`;
          if (s.length !== Math.trunc(l.quantity)) return `Seriales no coinciden en ${p.name}.`;
        }
      }
    }
    return null;
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");
    setLoading(true);
    try {
      let payload: any;
      if (mode === "so") {
        payload = {
          salesOrderId: Number(soId),
          warehouseId:  pendingDoc!.warehouseId,
          deliveryDate: new Date(deliveryDate).toISOString(),
          comments:     comments?.trim() || null,
          lines: soLines.filter((l) => l.quantity > 0).map((l) => ({
            salesOrderLineId: l.soLineId,
            productId:        l.productId,
            quantity:         Number(l.quantity),
            unitPrice:        Number(l.unitPrice),
            discountPercent:  Number(l.discountPercent || 0),
            taxId:            l.taxId || null,
            batchNumber:      l.batchNumber?.trim() || null,
            serialNumbers:    l.serialNumbers?.trim() || null,
          })),
        };
      } else {
        payload = {
          customerId:   directCustomerId,
          warehouseId:  directWarehouseId,
          deliveryDate: new Date(deliveryDate).toISOString(),
          comments:     comments?.trim() || null,
          lines: directLines.filter((l) => l.productId && l.quantity > 0).map((l) => ({
            productId:        l.productId,
            quantity:         Number(l.quantity),
            unitPrice:        Number(l.unitPrice),
            discountPercent:  Number(l.discountPercent || 0),
            taxId:            l.taxId || null,
            batchNumber:      l.batchNumber?.trim() || null,
            serialNumbers:    l.serialNumbers?.trim() || null,
          })),
        };
      }
      const res = await api.post("/salesdeliveries", payload);
      const { docNumber } = res.data ?? {};
      await Swal.fire("OK", `Entrega ${docNumber ?? ""} creada. Stock descontado.`, "success");
      router.push("/deliveries");
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar la entrega"), "error");
    } finally { setLoading(false); }
  };

  // Track status chip for SO lines
  const trackStatus = (l: SOLineDraft) => {
    const p = productMap.get(l.productId);
    if (!p?.isBatchManaged && !p?.isSerialManaged) return null;
    const parts: string[] = [];
    if (p?.isBatchManaged)  parts.push(l.batchNumber?.trim() ? "Lote: OK" : "Lote: Falta");
    if (p?.isSerialManaged) { const s = parseSerials(l.serialNumbers); parts.push(s.length === Math.trunc(l.quantity || 0) && s.length > 0 ? "Serial: OK" : "Serial: Falta"); }
    const ok = parts.every((x) => x.includes("OK"));
    return <span className={`ml-2 px-2 py-0.5 rounded text-xs ${ok ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>{ok ? "Tracking OK" : "Tracking incompleto"}</span>;
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <PageShell
      icon={<Truck className="h-6 w-6 text-orange-500" />}
      title="Nueva Entrega de Venta"
      subtitle={mode === "so" ? "Entrega desde una OV OPEN. Descuenta stock (Stocks, Lotes, Series)." : "Entrega directa a cliente sin OV previa. Descuenta stock."}
      chips={
        <>
          <Chip tone="neutral">Líneas: {mode === "so" ? soLines.length : directLines.length}</Chip>
          <Chip tone="warn">Total est.: {money(totals)}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={() => router.push("/deliveries")} variant="outline">Volver</Button>
          <Button onClick={loadLookups} variant="outline" disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" />Refrescar</Button>
          <Button onClick={save} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow" disabled={loading}>
            <Save className="mr-2 h-4 w-4" /> Guardar Entrega
          </Button>
        </>
      }
    >
      {/* MODE TOGGLE */}
      <div className="flex gap-2 mb-2">
        <Button variant={mode === "so" ? "default" : "outline"} className={mode === "so" ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white" : "bg-white"} onClick={() => setMode("so")}>
          Con Orden de Venta
        </Button>
        <Button variant={mode === "direct" ? "default" : "outline"} className={mode === "direct" ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white" : "bg-white"} onClick={() => setMode("direct")}>
          <User2 className="mr-2 h-4 w-4" /> Sin OV (Directa)
        </Button>
      </div>

      {/* CABECERA */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader icon={<ShoppingCart className="h-5 w-5 text-orange-500" />} title="Cabecera" subtitle={mode === "so" ? "Seleccioná la OV, fecha y comentarios." : "Seleccioná cliente, depósito, fecha y comentarios."} />
        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {mode === "so" && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700">Orden de Venta (OPEN)</label>
                <Select value={soId ? String(soId) : ""} onValueChange={(v) => { const id = Number(v); setSoId(id); loadPending(id); }}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccione OV..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {openSOs.map((so) => <SelectItem key={so.id} value={String(so.id)}>{so.docNumber} — {so.customerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Fecha Entrega</label>
                <div className="relative">
                  <CalendarDays className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="pl-9 bg-white" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Depósito</label>
                <div className="relative">
                  <Building2 className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input value={pendingDoc?.warehouseName ?? (pendingDoc?.warehouseId ? String(pendingDoc.warehouseId) : "")} disabled className="pl-9 bg-white" />
                </div>
              </div>
            </>
          )}

          {mode === "direct" && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700">Cliente <span className="text-red-500">*</span></label>
                <Select value={directCustomerId ? String(directCustomerId) : ""} onValueChange={(v) => setDirectCustomerId(Number(v))}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {customers.slice().sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.razonSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Depósito <span className="text-red-500">*</span></label>
                <Select value={directWarehouseId ? String(directWarehouseId) : ""} onValueChange={(v) => setDirectWarehouseId(Number(v))}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar depósito..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Fecha Entrega</label>
                <div className="relative">
                  <CalendarDays className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="pl-9 bg-white" />
                </div>
              </div>
            </>
          )}

          <div className={`${mode === "so" ? "md:col-span-1" : "md:col-span-1"}`}>
            <label className="text-sm font-semibold text-gray-700">Comentarios</label>
            <div className="relative">
              <MessageSquare className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Observaciones..." className="pl-9 bg-white" rows={1} />
            </div>
          </div>
        </div>
      </Card>

      {/* LÍNEAS */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5 text-orange-500" />}
          title={mode === "so" ? "Líneas pendientes de la OV" : "Líneas de entrega"}
          subtitle={mode === "so" ? "Editá cantidades y completá tracking si aplica." : "Añadí los productos a entregar."}
          right={<div className="text-sm text-gray-600">Total estimado: <b>{money(totals)}</b></div>}
        />
        <Separator className="my-4" />

        {/* SO MODE */}
        {mode === "so" && (
          <>
            {!pendingDoc && <div className="text-gray-500">Seleccioná una OV abierta para cargar los pendientes.</div>}
            {!!pendingDoc && (
              <div className="space-y-4">
                {soLines.map((l) => {
                  const p = productMap.get(l.productId);
                  return (
                    <div key={l.soLineId} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {l.productName} <span className="text-xs text-gray-500">({l.productCode})</span>
                            {trackStatus(l)}
                          </div>
                          <div className="text-xs text-gray-600">
                            Pendiente: <b>{l.pendingQty}</b>
                            {p?.isBatchManaged  && <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-700">Lote</span>}
                            {p?.isSerialManaged && <span className="ml-2 px-2 py-0.5 rounded bg-purple-100 text-purple-700">Serial</span>}
                          </div>
                        </div>
                        {(p?.isBatchManaged || p?.isSerialManaged) && (
                          <Button type="button" variant="outline" className="bg-white" onClick={() => openTrack(l.soLineId, "so")}>
                            {p?.isBatchManaged  && !p?.isSerialManaged && <Boxes   className="mr-2 h-4 w-4" />}
                            {p?.isSerialManaged && !p?.isBatchManaged  && <Barcode className="mr-2 h-4 w-4" />}
                            Tracking
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Cantidad a entregar</label>
                          <Input type="number" min={0} step={p?.isSerialManaged ? 1 : "0.01"} value={l.quantity}
                            onChange={(e) => setSOLine(l.soLineId, { quantity: Number(e.target.value) })} className="bg-white" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Precio s/IVA</label>
                          <Input type="text" inputMode="numeric"
                            value={fmtMoneyInput(String(l.unitPrice ?? ""))}
                            onChange={(e) => setSOLine(l.soLineId, { unitPrice: moneyToNumber(e.target.value) })} className="bg-white" />
                          {taxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-0.5">IVA {taxRate(l.taxId)}%</div>}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Precio c/IVA</label>
                          <Input type="text" inputMode="numeric"
                            value={fmtMoneyInput(String(withIva(l.unitPrice, l.taxId)))}
                            onChange={(e) => setSOLine(l.soLineId, { unitPrice: sinIva(moneyToNumber(e.target.value), l.taxId) })} className="bg-white" />
                          {taxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-0.5">÷ {(1 + taxRate(l.taxId) / 100).toFixed(2)}</div>}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Desc %</label>
                          <Input type="number" min={0} max={100} step="0.01" value={l.discountPercent}
                            onChange={(e) => setSOLine(l.soLineId, { discountPercent: Number(e.target.value) })} className="bg-white" />
                        </div>
                        <div className="flex items-end">
                          <div className="text-sm text-gray-600">Subtotal: <b>{money(round2(l.quantity * l.unitPrice * ((100 - (l.discountPercent || 0)) / 100)))}</b></div>
                        </div>
                      </div>
                      {(p?.isBatchManaged || p?.isSerialManaged) && (
                        <div className="mt-3 text-xs text-gray-600">
                          {p?.isBatchManaged  && <span className="mr-4">Lote: <b>{l.batchNumber?.trim() || "—"}</b></span>}
                          {p?.isSerialManaged && <span>Seriales: <b>{parseSerials(l.serialNumbers).length}</b> / <b>{Math.trunc(l.quantity || 0)}</b></span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* DIRECT MODE */}
        {mode === "direct" && (
          <div>
            <div className="space-y-3">
              {directLines.map((l) => {
                const prod = l.productId ? productMap.get(l.productId) : null;
                const isBatch = !!prod?.isBatchManaged; const isSerial = !!prod?.isSerialManaged;
                const sub = round2(l.quantity * l.unitPrice * (1 - (l.discountPercent || 0) / 100));
                return (
                  <div key={l.id} className="border rounded-xl p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-3">
                        <label className="text-xs font-semibold text-gray-600">Producto</label>
                        <Select value={l.productId ? String(l.productId) : ""} onValueChange={(v) => {
                          const pid = Number(v); const p = productMap.get(pid);
                          setDirLine(l.id, { productId: pid, unitPrice: Number(p?.price ?? 0), taxId: p?.taxId ?? null, batchNumber: "", serialNumbers: "" });
                        }}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {products.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-gray-600">Cant.</label>
                        <Input type="number" min={0} step={isSerial ? 1 : "0.01"} value={l.quantity}
                          onChange={(e) => setDirLine(l.id, { quantity: Number(e.target.value), batchNumber: "", serialNumbers: "" })} className="bg-white" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-600">Precio s/IVA</label>
                        <Input type="text" inputMode="numeric"
                          value={fmtMoneyInput(String(l.unitPrice ?? ""))}
                          onChange={(e) => setDirLine(l.id, { unitPrice: moneyToNumber(e.target.value) })} className="bg-white" />
                        {taxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-0.5">IVA {taxRate(l.taxId)}%</div>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-600">Precio c/IVA</label>
                        <Input type="text" inputMode="numeric"
                          value={fmtMoneyInput(String(withIva(l.unitPrice, l.taxId)))}
                          onChange={(e) => setDirLine(l.id, { unitPrice: sinIva(moneyToNumber(e.target.value), l.taxId) })} className="bg-white" />
                        {taxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-0.5">÷ {(1 + taxRate(l.taxId) / 100).toFixed(2)}</div>}
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-gray-600">Desc %</label>
                        <Input type="number" min={0} max={100} step="0.01" value={l.discountPercent}
                          onChange={(e) => setDirLine(l.id, { discountPercent: Number(e.target.value) })} className="bg-white" />
                      </div>
                      <div className="md:col-span-3 flex gap-1 items-end">
                        {(isBatch || isSerial) && (
                          <Button type="button" variant="outline" size="sm" className="bg-white flex-1" onClick={() => openTrack(l.id, "direct")}>
                            {isBatch  && !isSerial && <Boxes   className="mr-1 h-4 w-4" />}
                            {isSerial && !isBatch  && <Barcode className="mr-1 h-4 w-4" />}
                            Tracking
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-9 w-9 p-0" onClick={() => remDirLine(l.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      {isBatch  && <span className={`px-2 py-0.5 rounded ${l.batchNumber?.trim() ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>Lote: {l.batchNumber?.trim() || "—"}</span>}
                      {isSerial && <span className={`px-2 py-0.5 rounded ${parseSerials(l.serialNumbers).length === Math.trunc(l.quantity || 0) && l.quantity > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>Seriales: {parseSerials(l.serialNumbers).length}/{Math.trunc(l.quantity || 0)}</span>}
                      {sub > 0 && <span className="ml-auto font-semibold text-gray-800">Subtotal: {money(sub)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {directLines.length === 0 && (
              <div className="text-gray-400 text-sm py-4 text-center border-2 border-dashed rounded-xl">No hay líneas. Hacé clic en "Agregar línea" para comenzar.</div>
            )}
            <Button className="mt-4 border border-[#2563eb] text-[#2563eb] bg-white hover:bg-blue-50" variant="outline" onClick={addDirLine}>
              <Plus className="mr-2 h-4 w-4" /> Agregar línea
            </Button>
          </div>
        )}
      </Card>

      {/* TRACKING DIALOG */}
      <Dialog open={trackOpen} onOpenChange={(v) => { setTrackOpen(v); if (!v) setOpenSerialPick(false); }}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tracking — {diagName}</DialogTitle>
            <DialogDescription>Seleccioná lote/serial según corresponda.</DialogDescription>
          </DialogHeader>
          {!diagProd ? (
            <div className="text-sm text-gray-600">Sin línea seleccionada.</div>
          ) : (
            <div className="space-y-4">
              {isBatchDlg && (
                <div className="border rounded-xl p-4 bg-gray-50 space-y-2">
                  <div className="font-semibold text-sm">Lote disponible</div>
                  <select className="w-full h-10 rounded-md border px-3 bg-white" value={diagBatch ?? ""} onChange={(e) => setDlgLine({ batchNumber: e.target.value })}>
                    <option value="">Seleccionar</option>
                    {batchOptions.map((b) => <option key={b.id} value={b.batchNumber}>{b.batchNumber} (Disp: {money(b.quantity || 0)})</option>)}
                  </select>
                  {batchOptions.length === 0 && <div className="text-[11px] text-gray-500">No hay stock por lote en este depósito.</div>}
                </div>
              )}
              {isSerialDlg && (
                <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
                  <div className="font-semibold text-sm">Seriales</div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" className="bg-white" onClick={() => {
                      const qty = Math.trunc(diagQty || 0);
                      if (!qty) { Swal.fire("Validación", "Primero cargá la cantidad.", "warning"); return; }
                      if (!isIntLike(diagQty)) { Swal.fire("Validación", "Producto serializado: cantidad debe ser entera.", "warning"); return; }
                      setSelSerials(parseSerials(diagSer)); setSerialSearch(""); setOpenSerialPick(true);
                    }}>Seleccionar seriales</Button>
                    <div className="text-sm text-gray-600">Seleccionados: <b>{selSerials.length}</b> / <b>{Math.trunc(diagQty || 0)}</b></div>
                  </div>
                  <div className="text-[11px] text-gray-600">Seriales en línea: <b>{parseSerials(diagSer).length}</b></div>
                  {diagQty > 0 && isIntLike(diagQty) && parseSerials(diagSer).length !== Math.trunc(diagQty) && (
                    <div className="text-[11px] text-yellow-700">Deben coincidir (cantidad vs seriales).</div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SERIAL PICKER */}
      <Dialog open={openSerialPick} onOpenChange={(v) => { setOpenSerialPick(v); if (!v) setSerialSearch(""); }}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Seleccionar seriales</DialogTitle>
            <DialogDescription>Marcá exactamente la misma cantidad de seriales que la cantidad a entregar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Buscar serial..." value={serialSearch} onChange={(e) => setSerialSearch(e.target.value)} className="bg-white" />
            <div className="h-[360px] overflow-auto border rounded-md p-3 space-y-2 bg-white">
              {serialOptions.filter((s) => (s.serialNumber ?? "").toLowerCase().includes(serialSearch.toLowerCase().trim())).map((s) => {
                const sn = s.serialNumber; const checked = selSerials.includes(sn);
                const qty = Math.trunc(diagQty || 0); const disable = !checked && selSerials.length >= qty;
                return (
                  <label key={s.id} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={checked} disabled={disable} onChange={(e) => {
                      const on = e.target.checked;
                      setSelSerials((p) => { if (on) { if (p.length >= qty) return p; return [...p, sn]; } return p.filter((x) => x !== sn); });
                    }} />
                    <span className={disable ? "text-gray-400" : ""}>{sn}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">Seleccionados: <b>{selSerials.length}</b> / {Math.trunc(diagQty || 0)}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setSelSerials([]); setDlgLine({ serialNumbers: "" }); }}>Limpiar</Button>
                <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow" onClick={() => { setDlgLine({ serialNumbers: selSerials.join(",") }); setOpenSerialPick(false); }}>Aplicar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
