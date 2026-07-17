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
  RefreshCcw,
  Save,
  Boxes,
  Barcode,
  ReceiptText,
  ShoppingCart,
  CalendarDays,
  ListChecks,
  Building2,
  MessageSquare,
  Plus,
  Trash2,
  User2,
  Wrench,
  Package,
} from "lucide-react";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { toErrorMsg } from "@/lib/api-error";

// ─── Types ───────────────────────────────────────────────────────────────────

type SalesOrderOpen = {
  id: number;
  docNumber: string;
  orderDate: string;
  customerId: number;
  customerName: string;
  warehouseId: number;
  warehouseName?: string | null;
  status: string;
};

type CreditTerm = {
  id: number;
  name: string;
  days: number;
  isActive: boolean;
};

type PendingLine = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  orderedQty: number;
  invoicedQty: number;
  pendingQty: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | null;
  taxRate: number;
};

type PendingDoc = {
  id: number;
  docNumber: string;
  orderDate: string;
  customerId: number;
  customerName: string;
  warehouseId: number;
  warehouseName?: string | null;
  customer?: {
    id: number;
    customerName?: string;
    creditTermId?: number | null;
    allowInstallments?: boolean;
    defaultInstallments?: number | null;
    maxInstallments?: number | null;
    creditLimit?: number | null;
  } | null;
  lines: PendingLine[];
};

type Product = {
  id: number;
  code: string;
  name: string;
  price?: number | null;
  taxId?: number | null;
  isBatchManaged?: boolean;
  isSerialManaged?: boolean;
};

type InvoiceLineDraft = {
  soLineId: number;
  productId: number;
  productCode: string;
  productName: string;
  pendingQty: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | null;
  batchNumber: string;
  serialNumbers: string;
};

type BatchPickDto = {
  id: number;
  productId: number;
  warehouseId: number;
  warehouseName?: string | null;
  batchNumber: string;
  quantity: number;
  expirationDate?: string | null;
};

type SerialPickDto = {
  id: number;
  productId: number;
  warehouseId: number;
  warehouseName?: string | null;
  serialNumber: string;
  isActive?: boolean;
};

type FiscalSeries = {
  id: number;
  documentType: string;
  timbradoNumber: string;
  validFrom: string;
  validTo: string;
  establishment: string;
  expeditionPoint: string;
  seriesName?: string | null;
  rangeFrom: number;
  rangeTo: number;
  nextNumber: number;
  isActive: boolean;
  location?: string | null;
};

// Direct-mode types
type Customer      = { id: number; razonSocial: string; code?: string };
type Warehouse     = { id: number; name: string };

type DirectLineDraft = {
  id:              number;
  lineType:        "ITEM" | "SERVICE";
  description:     string;
  productId:       number | null;
  quantity:        number;
  unitPrice:       number;
  discountPercent: number;
  taxId:           number | null;
  batchNumber:     string;
  serialNumbers:   string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseSerials = (s: string) =>
  (s ?? "")
    .split(/[\n,;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

const isIntegerLike = (n: number) => Number.isFinite(n) && Math.trunc(n) === n;

const fmtPY        = new Intl.NumberFormat("es-PY");
const onlyDigits   = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtMoneyInput = (s: string) => { const d = onlyDigits(s); return d ? fmtPY.format(Number(d)) : ""; };
const moneyToNumber = (s: string) => { const d = onlyDigits(s); return d ? Number(d) : 0; };
const money         = (n: number) => fmtPY.format(Number(n || 0));

const seriesLabel = (s: FiscalSeries) =>
  (s.seriesName && s.seriesName.trim()) ||
  `Timbrado ${s.timbradoNumber} (${s.establishment}-${s.expeditionPoint})`;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewSalesInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Lookups
  const [openSOs,      setOpenSOs]      = useState<SalesOrderOpen[]>([]);
  const [products,     setProducts]     = useState<Product[]>([]);
  const [creditTerms,  setCreditTerms]  = useState<CreditTerm[]>([]);
  const [creditTermId, setCreditTermId] = useState<number | null>(null);
  const [fiscalSeries, setFiscalSeries] = useState<FiscalSeries[]>([]);
  const [fiscalSeriesId, setFiscalSeriesId] = useState<number | null>(null);
  const [taxes,        setTaxes]        = useState<{id:number;rate:number}[]>([]);

  // Direct-mode lookups
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // SO mode selection
  const [soId,       setSoId]       = useState<number | "">("");
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);

  // Header fields
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comments,    setComments]    = useState("");

  // Payment / credit
  const [paymentType,        setPaymentType]        = useState<"CASH" | "CREDIT">("CASH");
  const [creditDays,         setCreditDays]         = useState<number>(0);
  const [hasCreditTerm,      setHasCreditTerm]      = useState<boolean>(true);
  const [creditInstallments, setCreditInstallments] = useState(false);
  const [installmentsCount,  setInstallmentsCount]  = useState<number>(2);
  const [firstDueDate,       setFirstDueDate]       = useState<string>("");
  const [installmentScheduleType, setInstallmentScheduleType] = useState<"INTERVAL" | "DAY_OF_MONTH">("INTERVAL");
  const [intervalDays,  setIntervalDays]  = useState<number>(30);
  const [dueDayOfMonth, setDueDayOfMonth] = useState<number>(5);
  const [firstDueRule,  setFirstDueRule]  = useState<"AUTO" | "NEXT_MONTH">("AUTO");

  // SO mode lines
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);

  // Tracking dialog state
  const [trackOpen,        setTrackOpen]        = useState(false);
  const [trackLineId,      setTrackLineId]       = useState<number | null>(null);
  const [batchOptions,     setBatchOptions]      = useState<BatchPickDto[]>([]);
  const [serialOptions,    setSerialOptions]     = useState<SerialPickDto[]>([]);
  const [openSerialPicker, setOpenSerialPicker]  = useState(false);
  const [serialSearch,     setSerialSearch]      = useState("");
  const [selectedSerials,  setSelectedSerials]   = useState<string[]>([]);

  // ── Mode & direct-mode state ─────────────────────────────────────────────
  const [mode,              setMode]              = useState<"so" | "direct" | "delivery">("so");
  const [directCustomerId,  setDirectCustomerId]  = useState<number | null>(null);
  const [directWarehouseId, setDirectWarehouseId] = useState<number | null>(null);
  const [directLines,       setDirectLines]       = useState<DirectLineDraft[]>([]);
  const [externalNumber,    setExternalNumber]    = useState("");
  const nextDLineId = useRef(1);
  const [trackMode, setTrackMode] = useState<"so" | "direct">("so");

  // ── Delivery mode state ───────────────────────────────────────────────────
  type DeliveryMini = { id: number; docNumber: string; customerName: string; total: number };
  type DeliveryLine = { id: number; productId: number; productCode: string; productName: string; quantity: number; unitPrice: number; discountPercent: number; taxId: number | null; lineTotal: number; batchNumber: string | null; serialNumbers: string | null };
  type DeliveryDetail = { id: number; docNumber: string; customerId: number; customerName: string; warehouseId: number; total: number; lines: DeliveryLine[] };
  const [deliveries,          setDeliveries]          = useState<DeliveryMini[]>([]);
  const [selectedDeliveryId,  setSelectedDeliveryId]  = useState<number | "">("");
  const [deliveryDetail,      setDeliveryDetail]      = useState<DeliveryDetail | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Lookups load ────────────────────────────────────────────────────────

  const loadLookups = async () => {
    try {
      const getCust = async () => {
        try { return await api.get("/sociosnegocio/clientes"); }
        catch {
          const r = await api.get("/sociosnegocio");
          return { data: (r.data ?? []).filter((c: any) => (c.partnerType ?? "").toUpperCase() === "C") };
        }
      };

      const [soRes, prodRes, termRes, seriesRes, whRes, custRes, taxRes, delivRes] = await Promise.all([
        api.get("/salesorders/open"),
        api.get("/products"),
        api.get("/creditterms"),
        api.get("/fiscaldocumentseries?documentType=FACTURA&onlyActive=true"),
        api.get("/warehouses"),
        getCust(),
        api.get("/taxes"),
        api.get("/salesdeliveries?invoiced=false&includeCancelled=false"),
      ]);

      setOpenSOs(soRes.data ?? []);
      setProducts(prodRes.data ?? []);
      setDeliveries((delivRes.data ?? []).map((d: any) => ({ id: d.id, docNumber: d.docNumber, customerName: d.customerName, total: d.total ?? 0 })));

      const terms: CreditTerm[] = termRes.data ?? [];
      setCreditTerms(terms.filter((t) => t.isActive));

      const series: FiscalSeries[] = seriesRes.data ?? [];
      setFiscalSeries(series);
      if (series.length === 1) setFiscalSeriesId(series[0].id);
      else setFiscalSeriesId(null);

      setWarehouses(whRes.data ?? []);
      setCustomers(custRes.data ?? []);
      setTaxes((taxRes.data ?? []).map((t: any) => ({ id: t.id, rate: Number(t.rate ?? 0) })));
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar datos"), "error");
    }
  };

  useEffect(() => { loadLookups(); }, []);

  useEffect(() => {
    if (!selectedDeliveryId) { setDeliveryDetail(null); return; }
    api.get(`/salesdeliveries/${selectedDeliveryId}`).then((res) => setDeliveryDetail(res.data)).catch(() => setDeliveryDetail(null));
  }, [selectedDeliveryId]);

  // sync creditDays with selected term
  useEffect(() => {
    if (!creditTermId) { setCreditDays(0); return; }
    const term = creditTerms.find((t) => t.id === creditTermId);
    setCreditDays(term?.days ?? 0);
  }, [creditTermId, creditTerms]);

  async function getCustomerCreditTerm(customerId: number): Promise<number | null> {
    try { const r = await api.get(`/sociosnegocio/${customerId}`); return r.data?.creditTermId ?? null; }
    catch { return null; }
  }

  const loadPending = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/salesorders/${id}/pending`);
      const doc: PendingDoc = res.data;
      setPendingDoc(doc);

      let termId = doc?.customer?.creditTermId ?? null;
      if (!termId && doc?.customerId) termId = await getCustomerCreditTerm(doc.customerId);

      setCreditTermId(termId);
      setHasCreditTerm(!!termId);

      if (termId) { const term = creditTerms.find((t) => t.id === termId); setCreditDays(term?.days ?? 0); }
      else setCreditDays(0);

      const suggestedN = Math.max(2, Math.trunc(doc?.customer?.defaultInstallments ?? 2));
      setInstallmentsCount(suggestedN);
      setCreditInstallments(false);
      setInstallmentScheduleType("INTERVAL");
      setIntervalDays(30);
      setDueDayOfMonth(5);
      setFirstDueRule("AUTO");

      const mapped: InvoiceLineDraft[] = (doc.lines ?? []).map((l) => ({
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
      }));
      setLines(mapped);

      const inv = new Date(invoiceDate);
      const suggested = new Date(inv);
      const days = termId ? (creditTerms.find((t) => t.id === termId)?.days ?? 0) : 0;
      suggested.setDate(suggested.getDate() + days);
      setFirstDueDate(suggested.toISOString().slice(0, 10));
    } catch (e: any) {
      setPendingDoc(null);
      setLines([]);
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar pendientes"), "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── Line mutators ───────────────────────────────────────────────────────

  const setLine = (soLineId: number, patch: Partial<InvoiceLineDraft>) => {
    setLines((prev) => prev.map((l) => (l.soLineId === soLineId ? { ...l, ...patch } : l)));
  };

  const setDirectLine = (id: number, patch: Partial<DirectLineDraft>) => {
    setDirectLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addDirectLine = (type: "ITEM" | "SERVICE" = "ITEM") => {
    const id = nextDLineId.current++;
    setDirectLines((prev) => [
      ...prev,
      { id, lineType: type, description: "", productId: null, quantity: 1, unitPrice: 0, discountPercent: 0, taxId: null, batchNumber: "", serialNumbers: "" },
    ]);
  };

  const removeDirectLine = (id: number) => {
    setDirectLines((prev) => prev.filter((l) => l.id !== id));
  };

  // ─── Derived / memos ────────────────────────────────────────────────────

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const taxMap     = useMemo(() => new Map(taxes.map((t) => [t.id, t.rate])), [taxes]);
  const getTaxRate = (taxId: number | null) => (taxId ? (taxMap.get(taxId) ?? 0) : 0);
  const calcWithIva = (price: number, taxId: number | null) => { const r = getTaxRate(taxId); return r > 0 ? Math.round(price * (1 + r / 100) * 100) / 100 : price; };
  const calcSinIva  = (priceC: number, taxId: number | null) => { const r = getTaxRate(taxId); return r > 0 ? Math.round(priceC / (1 + r / 100) * 100) / 100 : priceC; };

  // SO tracking line
  const trackLine = useMemo(
    () => lines.find((x) => x.soLineId === trackLineId) ?? null,
    [lines, trackLineId]
  );

  // Direct tracking line
  const directTrackLine = useMemo(
    () => directLines.find((x) => x.id === trackLineId) ?? null,
    [directLines, trackLineId]
  );

  // Unified dialog helpers (works for both modes)
  const dialogProductId = trackMode === "so" ? (trackLine?.productId ?? null) : (directTrackLine?.productId ?? null);
  const dialogQuantity  = trackMode === "so" ? (trackLine?.quantity  ?? 0)    : (directTrackLine?.quantity  ?? 0);
  const dialogBatch     = trackMode === "so" ? (trackLine?.batchNumber   ?? "") : (directTrackLine?.batchNumber   ?? "");
  const dialogSerials   = trackMode === "so" ? (trackLine?.serialNumbers ?? "") : (directTrackLine?.serialNumbers ?? "");
  const dialogName      = trackMode === "so"
    ? (trackLine?.productName ?? "")
    : (dialogProductId ? (productMap.get(dialogProductId)?.name ?? "") : "");
  const isBatchDialog   = !!dialogProductId && !!productMap.get(dialogProductId)?.isBatchManaged;
  const isSerialDialog  = !!dialogProductId && !!productMap.get(dialogProductId)?.isSerialManaged;

  const setDialogLine = (patch: any) => {
    if (trackMode === "so" && trackLine)               setLine(trackLine.soLineId,      patch);
    else if (trackMode === "direct" && directTrackLine) setDirectLine(directTrackLine.id, patch);
  };

  // Totals (branches on mode)
  const totals = useMemo(() => {
    const src = mode === "direct"
      ? directLines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discountPercent: l.discountPercent }))
      : lines.map((l)        => ({ quantity: l.quantity, unitPrice: l.unitPrice, discountPercent: l.discountPercent }));
    let sub = 0;
    for (const l of src) {
      if (l.quantity <= 0) continue;
      sub += round2(l.quantity * (l.unitPrice || 0) * ((100 - (l.discountPercent || 0)) / 100));
    }
    return { sub: round2(sub), total: round2(sub) };
  }, [lines, directLines, mode]);

  const computedDueDate = useMemo(() => {
    const inv = new Date(invoiceDate);
    if (!Number.isFinite(inv.getTime())) return "";

    if (paymentType === "CASH") return inv.toISOString().slice(0, 10);

    if (!creditInstallments) {
      const d = new Date(inv);
      d.setDate(d.getDate() + (creditDays || 0));
      return d.toISOString().slice(0, 10);
    }

    if (firstDueDate) return firstDueDate;

    const base = new Date(inv);
    base.setDate(base.getDate() + (creditDays || 0));

    if (installmentScheduleType === "DAY_OF_MONTH") {
      const dueDay = Math.min(31, Math.max(1, dueDayOfMonth || 1));
      const year  = base.getUTCFullYear();
      const month = base.getUTCMonth();

      const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const day  = Math.min(dueDay, last);
      let candidate = new Date(Date.UTC(year, month, day));

      if (firstDueRule === "NEXT_MONTH") {
        const nm    = new Date(Date.UTC(year, month + 1, 1));
        const last2 = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth() + 1, 0)).getUTCDate();
        const day2  = Math.min(dueDay, last2);
        candidate   = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth(), day2));
        return candidate.toISOString().slice(0, 10);
      }

      if (base.getUTCDate() > dueDay) {
        const nm    = new Date(Date.UTC(year, month + 1, 1));
        const last2 = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth() + 1, 0)).getUTCDate();
        const day2  = Math.min(dueDay, last2);
        candidate   = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth(), day2));
      }

      return candidate.toISOString().slice(0, 10);
    }

    return base.toISOString().slice(0, 10);
  }, [invoiceDate, paymentType, creditInstallments, creditDays, firstDueDate, installmentScheduleType, dueDayOfMonth, firstDueRule]);

  const installmentsPreview = useMemo(() => {
    if (paymentType !== "CREDIT" || !creditInstallments) return [];

    const n    = Math.max(1, Math.trunc(installmentsCount || 1));
    const base = totals.total || 0;
    if (n <= 1) return [];

    const per = round2(base / n);

    const clampDay = (year: number, month0: number, dueDay: number) => {
      const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
      const day  = Math.min(Math.max(1, dueDay), last);
      return new Date(Date.UTC(year, month0, day));
    };

    let baseDate: Date;
    if (firstDueDate) baseDate = new Date(firstDueDate);
    else {
      const inv = new Date(invoiceDate);
      baseDate = new Date(inv);
      baseDate.setDate(baseDate.getDate() + (creditDays || 0));
    }
    if (!Number.isFinite(baseDate.getTime())) baseDate = new Date();

    const out: Array<{ n: number; due: string; amount: number }> = [];
    let acc = 0;

    if (installmentScheduleType === "DAY_OF_MONTH") {
      const dueDay = Math.min(31, Math.max(1, dueDayOfMonth || 1));

      let firstDue = baseDate;
      if (!firstDueDate) {
        const y = baseDate.getUTCFullYear();
        const m = baseDate.getUTCMonth();
        let candidate = clampDay(y, m, dueDay);

        if (firstDueRule === "NEXT_MONTH") {
          const nm = new Date(Date.UTC(y, m + 1, 1));
          candidate = clampDay(nm.getUTCFullYear(), nm.getUTCMonth(), dueDay);
        } else if (baseDate.getUTCDate() > dueDay) {
          const nm = new Date(Date.UTC(y, m + 1, 1));
          candidate = clampDay(nm.getUTCFullYear(), nm.getUTCMonth(), dueDay);
        }

        firstDue = candidate;
      } else {
        firstDue = clampDay(firstDue.getUTCFullYear(), firstDue.getUTCMonth(), dueDay);
      }

      for (let k = 1; k <= n; k++) {
        const amt = k === n ? round2(base - acc) : per;
        acc = round2(acc + amt);

        if (k === 1) { out.push({ n: k, due: firstDue.toISOString().slice(0, 10), amount: amt }); continue; }

        const nm      = new Date(Date.UTC(firstDue.getUTCFullYear(), firstDue.getUTCMonth() + (k - 1), 1));
        const clamped = clampDay(nm.getUTCFullYear(), nm.getUTCMonth(), dueDay);
        out.push({ n: k, due: clamped.toISOString().slice(0, 10), amount: amt });
      }

      return out;
    }

    // INTERVAL
    for (let k = 1; k <= n; k++) {
      const amt = k === n ? round2(base - acc) : per;
      acc = round2(acc + amt);
      const due = new Date(baseDate);
      if (k > 1) due.setDate(due.getDate() + (intervalDays || 30) * (k - 1));
      out.push({ n: k, due: due.toISOString().slice(0, 10), amount: amt });
    }

    return out;
  }, [paymentType, creditInstallments, installmentsCount, firstDueDate, invoiceDate, creditDays, totals.total, installmentScheduleType, intervalDays, dueDayOfMonth, firstDueRule]);

  const isLineBatch  = (l: InvoiceLineDraft) => !!productMap.get(l.productId)?.isBatchManaged;
  const isLineSerial = (l: InvoiceLineDraft) => !!productMap.get(l.productId)?.isSerialManaged;

  const chips = useMemo(() => {
    if (mode === "direct") {
      const used = directLines.filter((l) => l.productId && l.quantity > 0).length;
      return { used, trackingNeeded: 0 };
    }
    const used           = lines.filter((l) => l.quantity > 0).length;
    const trackingNeeded = lines.filter((l) => { const p = productMap.get(l.productId); return Boolean(p?.isBatchManaged || p?.isSerialManaged); }).length;
    return { used, trackingNeeded };
  }, [lines, directLines, mode, productMap]);

  // ─── Stock helpers ───────────────────────────────────────────────────────

  async function loadBatchOptions(productId: number, whId: number) {
    const res = await api.get(`/stock/batches/${productId}?warehouseId=${whId}&onlyAvailable=true`);
    setBatchOptions(res.data ?? []);
  }

  async function loadSerialOptions(productId: number, whId: number) {
    const res = await api.get(`/stock/serials/${productId}?warehouseId=${whId}`);
    setSerialOptions(res.data ?? []);
  }

  const openTrackDialog = async (lineId: number, tm: "so" | "direct" = "so") => {
    setTrackMode(tm);
    setTrackLineId(lineId);

    let productId: number;
    let whId: number;

    if (tm === "so") {
      const l = lines.find((x) => x.soLineId === lineId);
      if (!l || !pendingDoc) { setTrackOpen(true); return; }
      productId = l.productId;
      whId      = Number(pendingDoc.warehouseId);
      setSelectedSerials(parseSerials(l.serialNumbers));
    } else {
      const l = directLines.find((x) => x.id === lineId);
      if (!l || !l.productId || !directWarehouseId) {
        Swal.fire("Aviso", "Seleccioná producto y depósito antes de usar Tracking.", "warning");
        return;
      }
      productId = l.productId;
      whId      = directWarehouseId;
      setSelectedSerials(parseSerials(l.serialNumbers));
    }

    setBatchOptions([]);
    setSerialOptions([]);
    setSerialSearch("");

    const p = productMap.get(productId);

    try {
      if (p?.isBatchManaged) await loadBatchOptions(productId, whId);
      if (p?.isSerialManaged) await loadSerialOptions(productId, whId);
    } catch {
      Swal.fire("Aviso", "No se pudo cargar lotes/seriales disponibles.", "warning");
    }

    setTrackOpen(true);
  };

  // ─── Validate ────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if ((fiscalSeries?.length ?? 0) > 1 && !fiscalSeriesId)
      return "Seleccioná la Serie (Timbrado) para emitir la factura.";

    if (paymentType === "CREDIT" && creditInstallments) {
      const n = Math.trunc(installmentsCount || 0);
      if (n < 2) return "Si activás 'Crédito a cuotas', la cantidad debe ser >= 2.";
      if (installmentScheduleType === "INTERVAL") {
        if (!intervalDays || intervalDays < 1) return "IntervalDays inválido (>= 1).";
      } else {
        if (!dueDayOfMonth || dueDayOfMonth < 1 || dueDayOfMonth > 31) return "Día de vencimiento inválido (1..31).";
        if (!firstDueRule) return "Seleccioná la regla de primera cuota (AUTO/NEXT_MONTH).";
      }
    }

    if (mode === "delivery") {
      if (!selectedDeliveryId) return "Seleccioná una entrega.";
      return null;
    }

    if (mode === "direct") {
      if (!directCustomerId) return "Seleccioná el cliente.";
      if (!directLines.length) return "Añadí al menos una línea.";

      const itemLines = directLines.filter((l) => l.lineType === "ITEM" && l.productId && l.quantity > 0);
      const serviceLines = directLines.filter((l) => l.lineType === "SERVICE");

      if (itemLines.length > 0 && !directWarehouseId)
        return "Seleccioná el depósito (requerido para líneas ITEM).";
      if (itemLines.length === 0 && serviceLines.length === 0)
        return "Añadí al menos una línea ITEM o SERVICIO con datos válidos.";

      for (const l of serviceLines) {
        if (!l.description?.trim()) return "Las líneas SERVICIO requieren descripción.";
        if (l.quantity <= 0) return "Cantidad inválida en línea de servicio.";
      }

      for (const l of itemLines) {
        if (!l.productId)   return "Seleccioná el producto en todas las líneas ITEM.";
        if (l.quantity <= 0) return "Cantidad inválida.";
        const p = productMap.get(l.productId);
        if (p?.isBatchManaged && !l.batchNumber?.trim())
          return `${p.name} requiere lote. Cargalo desde Tracking.`;
        if (p?.isSerialManaged) {
          if (!isIntegerLike(l.quantity)) return `${p.name} es serializado. La cantidad debe ser entera.`;
          const serials = parseSerials(l.serialNumbers);
          if (!serials.length) return `${p.name} requiere seriales. Cargalos desde Tracking.`;
          if (serials.length !== Math.trunc(l.quantity)) return `Seriales no coinciden con cantidad en ${p.name}.`;
        }
      }
      return null;
    }

    // SO mode
    if (!soId)       return "Seleccioná una Orden de Venta abierta.";
    if (!pendingDoc) return "No hay pendientes cargados.";
    if (!lines.length) return "No hay líneas pendientes.";

    const used = lines.filter((l) => l.quantity > 0);
    if (!used.length) return "Debés facturar al menos 1 línea (cantidad > 0).";

    for (const l of used) {
      if (l.quantity < 0)             return "Cantidad inválida.";
      if (l.quantity > l.pendingQty)  return `La cantidad excede el pendiente en ${l.productName}.`;
      const p       = productMap.get(l.productId);
      const isBatch  = !!p?.isBatchManaged;
      const isSerial = !!p?.isSerialManaged;
      if (isBatch && !l.batchNumber?.trim()) return `El producto ${l.productName} requiere lote. Cargalo desde Tracking.`;
      if (isSerial) {
        if (!isIntegerLike(l.quantity)) return `El producto ${l.productName} es serializado. La cantidad debe ser entera.`;
        const serials = parseSerials(l.serialNumbers);
        if (!serials.length) return `El producto ${l.productName} requiere seriales. Cargalos desde Tracking.`;
        if (serials.length !== Math.trunc(l.quantity))
          return `Seriales no coinciden con cantidad en ${l.productName}. Cant: ${Math.trunc(l.quantity)} / Seriales: ${serials.length}`;
      }
    }

    return null;
  };

  // ─── PDF helper ──────────────────────────────────────────────────────────

  const openPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/sales-invoice/${id}/pdf`, { responseType: "blob" });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url  = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  // ─── Save ────────────────────────────────────────────────────────────────

  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    setLoading(true);
    try {
      const safeIntervalDays = Math.trunc(Number(intervalDays || 30)) || 30;

      const commonPayload = {
        invoiceDate:  new Date(invoiceDate).toISOString(),
        paymentType,
        comments:     comments?.trim() || null,
        externalNumber: externalNumber?.trim() || null,
        fiscalSeriesId: fiscalSeriesId ?? null,
        creditTermId:   paymentType === "CREDIT" ? creditTermId : null,
        creditDays:     paymentType === "CREDIT" ? Number(creditDays || 0) : 0,
        creditInstallments: paymentType === "CREDIT" ? !!creditInstallments : false,
        installmentsCount:  paymentType === "CREDIT" && creditInstallments ? Math.trunc(installmentsCount || 0) : null,
        firstDueDate: paymentType === "CREDIT" && creditInstallments && firstDueDate ? new Date(firstDueDate).toISOString() : null,
        intervalDays: safeIntervalDays,
        installmentScheduleType: paymentType === "CREDIT" && creditInstallments ? installmentScheduleType : null,
        dueDayOfMonth: paymentType === "CREDIT" && creditInstallments && installmentScheduleType === "DAY_OF_MONTH" ? Math.trunc(dueDayOfMonth || 0) : null,
        firstDueRule:  paymentType === "CREDIT" && creditInstallments && installmentScheduleType === "DAY_OF_MONTH" ? firstDueRule : null,
      };

      let payload: any;

      if (mode === "delivery") {
        payload = {
          ...commonPayload,
          salesDeliveryId: Number(selectedDeliveryId),
        };
      } else if (mode === "direct") {
        payload = {
          ...commonPayload,
          customerId:  directCustomerId,
          warehouseId: directWarehouseId || null,
          directLines: directLines
            .filter((l) =>
              (l.lineType === "SERVICE" && l.description?.trim() && l.quantity > 0) ||
              (l.lineType !== "SERVICE" && l.productId && l.quantity > 0)
            )
            .map((l) => ({
              lineType:        l.lineType,
              description:     l.lineType === "SERVICE" ? l.description?.trim() : null,
              productId:       l.lineType === "SERVICE" ? null : l.productId,
              quantity:        Number(l.quantity),
              unitPrice:       Number(l.unitPrice),
              discountPercent: Number(l.discountPercent || 0),
              taxId:           l.taxId || null,
              batchNumber:     l.lineType === "SERVICE" ? null : (l.batchNumber?.trim() || null),
              serialNumbers:   l.lineType === "SERVICE" ? null : (l.serialNumbers?.trim() || null),
            })),
        };
      } else {
        const usedLines = lines
          .filter((l) => l.quantity > 0)
          .map((l) => ({
            salesOrderLineId: l.soLineId,
            quantity:         Number(l.quantity),
            batchNumber:      l.batchNumber?.trim() || null,
            serialNumbers:    l.serialNumbers?.trim() || null,
          }));

        payload = {
          ...commonPayload,
          salesOrderId: Number(soId),
          lines: usedLines,
        };
      }

      const res = await api.post("/salesinvoices", payload);

      const newId =
        res?.data?.id ??
        res?.data?.invoiceId ??
        res?.data?.arInvoiceId ??
        (typeof res?.data === "number" ? res.data : null);

      await Swal.fire("OK", "Factura de venta creada.", "success");

      if (newId) {
        try { await openPdfById(Number(newId)); }
        catch { Swal.fire("Aviso", "La factura se creó, pero no se pudo abrir el PDF.", "warning"); }
      }

      router.push("/sales-invoices");
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar la factura"), "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── Track status (SO mode) ──────────────────────────────────────────────

  const renderTrackStatus = (l: InvoiceLineDraft) => {
    const p        = productMap.get(l.productId);
    const isBatch  = !!p?.isBatchManaged;
    const isSerial = !!p?.isSerialManaged;
    const parts: string[] = [];
    if (isBatch)  parts.push(l.batchNumber?.trim() ? "Lote: OK" : "Lote: Falta");
    if (isSerial) {
      const serials = parseSerials(l.serialNumbers);
      const ok      = serials.length === Math.trunc(l.quantity || 0) && serials.length > 0;
      parts.push(ok ? "Serial: OK" : "Serial: Falta/No coincide");
    }
    if (!parts.length) return null;
    const okAll = parts.every((x) => x.includes("OK"));
    return (
      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${okAll ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>
        {okAll ? "Tracking OK" : "Tracking incompleto"}
      </span>
    );
  };

  const selectedFiscalSeries = useMemo(() => {
    if (!fiscalSeriesId) return null;
    return fiscalSeries.find((s) => s.id === fiscalSeriesId) ?? null;
  }, [fiscalSeries, fiscalSeriesId]);

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#C5A05A]" />}
      title="Nueva Factura de Venta"
      subtitle={
        mode === "so"       ? "Genera FV desde OV OPEN, con soporte de Tracking (lote/serial), Serie fiscal (Timbrado) y crédito a cuotas." :
        mode === "delivery" ? "Registrar factura a partir de una Entrega ya realizada (sin mover stock nuevamente)." :
                              "Factura directa sobre cliente, sin necesidad de una Orden de Venta previa."
      }
      chips={
        <>
          {mode !== "delivery" && <Chip tone="neutral">Líneas: {mode === "so" ? lines.length : directLines.length}</Chip>}
          {mode !== "delivery" && <Chip tone="info">Facturar: {chips.used}</Chip>}
          {mode === "so" && <Chip tone="neutral">Tracking: {chips.trackingNeeded}</Chip>}
          {mode !== "delivery" && <Chip tone="warn">Total est.: {money(totals.total)}</Chip>}
          {mode === "so" && pendingDoc ? <Chip tone="neutral">OV: {pendingDoc.docNumber}</Chip> : null}
          {mode === "direct" && directCustomerId ? (
            <Chip tone="neutral">{customers.find((c) => c.id === directCustomerId)?.razonSocial ?? ""}</Chip>
          ) : null}
          {mode === "delivery" && deliveryDetail && <Chip tone="ok">Entrega: {deliveryDetail.docNumber}</Chip>}
          {mode === "delivery" && deliveryDetail && <Chip tone="neutral">Cliente: {deliveryDetail.customerName}</Chip>}
          {mode === "delivery" && deliveryDetail && <Chip tone="neutral">Total: {money(deliveryDetail.total)}</Chip>}
          {selectedFiscalSeries ? <Chip tone="neutral">{seriesLabel(selectedFiscalSeries)}</Chip> : null}
        </>
      }
      right={
        <>
          <Button onClick={() => router.push("/sales-invoices")} variant="outline">Volver</Button>
          <Button onClick={loadLookups} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button onClick={save} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow" disabled={loading}>
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      {/* ── MODE TOGGLE ── */}
      <div className="flex gap-2 mb-2 flex-wrap">
        <Button
          variant={mode === "so" ? "default" : "outline"}
          className={mode === "so" ? "bg-[#C5A05A] hover:bg-[#b8934f] text-white" : "bg-white"}
          onClick={() => setMode("so")}
        >
          Con Orden de Venta
        </Button>
        <Button
          variant={mode === "direct" ? "default" : "outline"}
          className={mode === "direct" ? "bg-[#C5A05A] hover:bg-[#b8934f] text-white" : "bg-white"}
          onClick={() => setMode("direct")}
        >
          <User2 className="mr-2 h-4 w-4" />
          Sin OV (Directo)
        </Button>
        <Button
          variant={mode === "delivery" ? "default" : "outline"}
          className={mode === "delivery" ? "bg-[#C5A05A] hover:bg-[#b8934f] text-white" : "bg-white"}
          onClick={() => setMode("delivery")}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          Desde Entrega
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODO: DESDE ENTREGA
      ══════════════════════════════════════════════════════════════════ */}
      {mode === "delivery" && (
        <div className="space-y-4">
          {/* Selección de Entrega */}
          <Card className="border-slate-200 p-4 shadow-sm">
            <SectionHeader icon={<ShoppingCart className="h-5 w-5 text-[#C5A05A]" />} title="Seleccionar Entrega" subtitle="Elegí una entrega ya despachada y pendiente de facturación." />
            <Separator className="my-4" />
            <div className="max-w-xl">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Entrega *</label>
              <Select value={selectedDeliveryId ? String(selectedDeliveryId) : ""} onValueChange={(v) => setSelectedDeliveryId(v ? Number(v) : "")}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar entrega..." /></SelectTrigger>
                <SelectContent className="bg-white">
                  {deliveries.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.docNumber} · {d.customerName} · {money(d.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deliveries.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay entregas pendientes de facturación.</p>}
            </div>
            {deliveryDetail && (
              <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm space-y-1">
                <div><strong>Cliente:</strong> {deliveryDetail.customerName}</div>
                <div><strong>Entrega:</strong> {deliveryDetail.docNumber} · <strong>Total:</strong> {money(deliveryDetail.total)}</div>
                <div><strong>Líneas:</strong> {deliveryDetail.lines.length} producto(s)</div>
              </div>
            )}
          </Card>

          {/* Líneas de la entrega (sólo lectura) */}
          {deliveryDetail && deliveryDetail.lines.length > 0 && (
            <Card className="border-slate-200 p-4 shadow-sm">
              <SectionHeader icon={<ListChecks className="h-5 w-5 text-[#C5A05A]" />} title="Líneas de la Entrega" subtitle="El stock ya fue descontado al despachar. Esta factura es sólo financiera." />
              <Separator className="my-4" />
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Precio Unit.</th>
                      <th className="px-3 py-2 text-right">Desc %</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-left">Lote/Serie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveryDetail.lines.map((l) => (
                      <tr key={l.id} className="bg-white">
                        <td className="px-3 py-2">{l.productCode} — {l.productName}</td>
                        <td className="px-3 py-2 text-right">{l.quantity}</td>
                        <td className="px-3 py-2 text-right">{money(l.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{l.discountPercent > 0 ? `${l.discountPercent}%` : "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(l.lineTotal)}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{l.batchNumber || l.serialNumbers || "—"}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={4} className="px-3 py-2 text-right text-slate-600">Total Entrega:</td>
                      <td className="px-3 py-2 text-right">{money(deliveryDetail.total)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Datos de la Factura */}
          {deliveryDetail && (
            <Card className="border-slate-200 p-4 shadow-sm">
              <SectionHeader icon={<ReceiptText className="h-5 w-5 text-[#C5A05A]" />} title="Datos de la Factura" subtitle="Completá fecha, serie fiscal y condición de pago." />
              <Separator className="my-4" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Fecha Factura</label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="bg-white mt-1" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Serie Fiscal</label>
                  <Select value={fiscalSeriesId ? String(fiscalSeriesId) : ""} onValueChange={(v) => setFiscalSeriesId(v ? Number(v) : null)}>
                    <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {fiscalSeries.map((s) => <SelectItem key={s.id} value={String(s.id)}>{seriesLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Comentarios</label>
                  <Input placeholder="Opcional" value={comments} onChange={(e) => setComments(e.target.value)} className="bg-white mt-1" />
                </div>
                <div className="md:col-span-4">
                  <label className="text-sm font-semibold text-gray-700">Tipo de pago</label>
                  <div className="flex gap-2 mt-1">
                    {(["CASH", "CREDIT"] as const).map((pt) => (
                      <button key={pt} type="button" onClick={() => setPaymentType(pt)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${paymentType === pt ? "bg-[#C5A05A] text-white border-[#C5A05A]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                        {pt === "CASH" ? "Contado" : "Crédito"}
                      </button>
                    ))}
                  </div>
                </div>
                {paymentType === "CREDIT" && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Condición de crédito</label>
                      <Select value={creditTermId ? String(creditTermId) : ""} onValueChange={(v) => setCreditTermId(v ? Number(v) : null)}>
                        <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="-- Sin condición --" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {creditTerms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.days} días)</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Días de crédito</label>
                      <Input type="number" min={0} value={creditDays} onChange={(e) => setCreditDays(Number(e.target.value))} className="bg-white mt-1" />
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── CABECERA + CONDICIÓN DE PAGO ── */}
      {mode !== "delivery" && (
      <Card className="border-slate-200 p-5 shadow-sm">

        {/* Header compacto */}
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-[#C5A05A]" />
          <div>
            <p className="font-semibold text-gray-800 leading-tight">Datos de la factura</p>
            <p className="text-[11px] text-gray-500">Cliente, fechas, serie fiscal y condición de pago.</p>
          </div>
        </div>

        {/* Grid principal — fila 1: campos de cabecera + tipo de pago */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">

          {/* ── SO mode ── */}
          {mode === "so" && (
            <>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600">Orden de Venta (OPEN)</label>
                <Select
                  value={soId ? String(soId) : ""}
                  onValueChange={(v) => { const id = Number(v); setSoId(id); loadPending(id); }}
                >
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccione OV abierta" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {openSOs.map((so) => (
                      <SelectItem key={so.id} value={String(so.id)}>{so.docNumber} — {so.customerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Depósito</label>
                <div className="relative mt-1">
                  <Building2 className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input value={pendingDoc?.warehouseName ?? String(pendingDoc?.warehouseId ?? "")} disabled className="pl-9 bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Fecha Factura</label>
                <div className="relative mt-1">
                  <CalendarDays className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="pl-9 bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Serie</label>
                <Select value={fiscalSeriesId ? String(fiscalSeriesId) : ""} onValueChange={(v) => setFiscalSeriesId(v ? Number(v) : null)}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {fiscalSeries.map((s) => <SelectItem key={s.id} value={String(s.id)}>{seriesLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedFiscalSeries && <div className="text-[11px] text-gray-500 mt-1">{selectedFiscalSeries.establishment}-{selectedFiscalSeries.expeditionPoint} · Timbrado {selectedFiscalSeries.timbradoNumber} · Próx {String(selectedFiscalSeries.nextNumber).padStart(7, "0")}</div>}
                {fiscalSeries.length > 1 && !fiscalSeriesId && <div className="text-[11px] text-yellow-700 mt-1">⚠️ Seleccioná una serie.</div>}
                {fiscalSeries.length === 0 && <div className="text-[11px] text-yellow-700 mt-1">⚠️ Sin series activas.</div>}
              </div>
            </>
          )}

          {/* ── Direct mode ── */}
          {mode === "direct" && (
            <>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600">Cliente <span className="text-red-500">*</span></label>
                <Select value={directCustomerId ? String(directCustomerId) : ""} onValueChange={(v) => setDirectCustomerId(Number(v))}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {customers.slice().sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.razonSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Depósito</label>
                <Select value={directWarehouseId ? String(directWarehouseId) : ""} onValueChange={(v) => setDirectWarehouseId(Number(v))}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Fecha Factura</label>
                <div className="relative mt-1">
                  <CalendarDays className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="pl-9 bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Serie</label>
                <Select value={fiscalSeriesId ? String(fiscalSeriesId) : ""} onValueChange={(v) => setFiscalSeriesId(v ? Number(v) : null)}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {fiscalSeries.map((s) => <SelectItem key={s.id} value={String(s.id)}>{seriesLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedFiscalSeries && <div className="text-[11px] text-gray-500 mt-1">{selectedFiscalSeries.establishment}-{selectedFiscalSeries.expeditionPoint} · Timbrado {selectedFiscalSeries.timbradoNumber} · Próx {String(selectedFiscalSeries.nextNumber).padStart(7, "0")}</div>}
                {fiscalSeries.length > 1 && !fiscalSeriesId && <div className="text-[11px] text-yellow-700 mt-1">⚠️ Seleccioná una serie.</div>}
              </div>
            </>
          )}

          {/* Tipo de pago — última columna fila 1 */}
          <div>
            <label className="text-xs font-semibold text-gray-600">Tipo de pago</label>
            <Select value={paymentType} onValueChange={(v) => { const nv = v === "CREDIT" ? "CREDIT" : "CASH"; setPaymentType(nv); if (nv === "CASH") setCreditInstallments(false); }}>
              <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="CASH">CONTADO</SelectItem>
                <SelectItem value="CREDIT">CRÉDITO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fila 2: Nro. Factura | Vencimiento | [si CREDIT: Término + Días + Cuotas] | Comentarios */}
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600">Nro. Factura <span className="font-normal text-gray-400">(pre-impreso)</span></label>
            <Input placeholder="001-001-0000001" value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} className="bg-white font-mono mt-1" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Vencimiento</label>
            <Input value={computedDueDate} disabled className="bg-white mt-1" />
            {paymentType === "CREDIT" && !creditTermId && <div className="text-[11px] text-yellow-700 mt-1">⚠️ Sin CreditTerm asignado.</div>}
          </div>

          {paymentType === "CREDIT" && (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600">Término de crédito</label>
                <Select value={creditTermId ? String(creditTermId) : ""} onValueChange={(v) => setCreditTermId(v ? Number(v) : null)}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {creditTerms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.days} días)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Días de crédito</label>
                <Input type="number" min={0} value={creditDays} onChange={(e) => setCreditDays(Number(e.target.value))} className="bg-white mt-1" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-[#C5A05A]" checked={creditInstallments} onChange={(e) => setCreditInstallments(e.target.checked)} />
                  <span className="text-xs font-semibold text-gray-700">Cuotas</span>
                </label>
              </div>
            </>
          )}

          <div className={paymentType === "CREDIT" ? "col-span-2 md:col-span-6" : "col-span-2 md:col-span-3"}>
            <label className="text-xs font-semibold text-gray-600">Comentarios</label>
            <div className="relative mt-1">
              <MessageSquare className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Observaciones..." className="pl-9 bg-white" rows={2} />
            </div>
          </div>
        </div>

        {/* Cuotas — sección expandible cuando CRÉDITO + cuotas activado */}
        {paymentType === "CREDIT" && creditInstallments && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Cantidad de cuotas</label>
              <Input type="number" min={2} step={1} value={installmentsCount} onChange={(e) => setInstallmentsCount(Number(e.target.value))} className="bg-white mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Esquema</label>
              <Select value={installmentScheduleType} onValueChange={(v) => setInstallmentScheduleType(v === "DAY_OF_MONTH" ? "DAY_OF_MONTH" : "INTERVAL")}>
                <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="INTERVAL">Cada X días</SelectItem>
                  <SelectItem value="DAY_OF_MONTH">Día fijo del mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {installmentScheduleType === "INTERVAL" ? (
              <div>
                <label className="text-xs font-semibold text-gray-600">Intervalo (días)</label>
                <Select value={String(intervalDays)} onValueChange={(v) => setIntervalDays(Number(v))}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="7">7</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-gray-600">Vence día</label>
                <Input type="number" min={1} max={31} value={dueDayOfMonth} onChange={(e) => setDueDayOfMonth(Number(e.target.value))} className="bg-white mt-1" />
              </div>
            )}
            {installmentScheduleType === "DAY_OF_MONTH" ? (
              <div>
                <label className="text-xs font-semibold text-gray-600">Primera cuota</label>
                <Select value={firstDueRule} onValueChange={(v) => setFirstDueRule(v === "NEXT_MONTH" ? "NEXT_MONTH" : "AUTO")}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="AUTO">Este mes si no pasó</SelectItem>
                    <SelectItem value="NEXT_MONTH">Siempre próximo mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : <div />}
            <div>
              <label className="text-xs font-semibold text-gray-600">1er vencimiento (opcional)</label>
              <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className="bg-white mt-1" />
            </div>
            {installmentsPreview.length > 0 && (
              <div className="col-span-2 md:col-span-5 bg-gray-50 border rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Preview cuotas</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                  {installmentsPreview.slice(0, 5).map((x) => (
                    <span key={x.n}>#{x.n} {x.due} — <b>{money(x.amount)}</b></span>
                  ))}
                  {installmentsPreview.length > 5 && <span className="text-gray-400">…+{installmentsPreview.length - 5}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      )}

      {/* ── LÍNEAS ── */}
      {mode !== "delivery" && (
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5 text-[#C5A05A]" />}
          title={mode === "so" ? "Líneas pendientes" : "Líneas de factura"}
          subtitle={mode === "so" ? "Editá cantidades, precios, descuentos y completá tracking si aplica." : "Añadí los productos a facturar directamente."}
          right={<div className="text-sm text-gray-600">Total estimado: <b>{money(totals.total)}</b></div>}
        />

        <Separator className="my-4" />

        {/* SO mode lines */}
        {mode === "so" && (
          <>
            {!pendingDoc && (
              <div className="text-gray-500">Seleccioná una OV abierta para cargar los pendientes.</div>
            )}

            {!!pendingDoc && (
              <div className="space-y-4">
                {lines.map((l) => {
                  const p        = productMap.get(l.productId);
                  const isBatch  = !!p?.isBatchManaged;
                  const isSerial = !!p?.isSerialManaged;

                  return (
                    <div key={l.soLineId} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {l.productName} <span className="text-xs text-gray-500">({l.productCode})</span>
                            {renderTrackStatus(l)}
                          </div>
                          <div className="text-xs text-gray-600">
                            Pendiente: <b>{l.pendingQty}</b> (OV Line ID: {l.soLineId})
                            {isBatch  && <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-700">Lote</span>}
                            {isSerial && <span className="ml-2 px-2 py-0.5 rounded bg-purple-100 text-purple-700">Serial</span>}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {(isBatch || isSerial) && (
                            <Button type="button" variant="outline" className="bg-white" onClick={() => openTrackDialog(l.soLineId, "so")}>
                              {isBatch  && !isSerial && <Boxes   className="mr-2 h-4 w-4" />}
                              {isSerial && !isBatch  && <Barcode className="mr-2 h-4 w-4" />}
                              Tracking
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Cantidad a facturar</label>
                          <Input
                            type="number" min={0} step={isSerial ? 1 : "0.01"}
                            value={l.quantity}
                            onChange={(e) => setLine(l.soLineId, { quantity: Number(e.target.value) })}
                            className="bg-white"
                          />
                          {isSerial && !isIntegerLike(l.quantity) && l.quantity > 0 && (
                            <div className="text-[11px] text-yellow-700 mt-1">Serializado: cantidad debe ser entera.</div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-600">Precio s/IVA</label>
                          <Input
                            type="text" inputMode="numeric"
                            value={fmtMoneyInput(String(l.unitPrice ?? ""))}
                            onChange={(e) => setLine(l.soLineId, { unitPrice: moneyToNumber(e.target.value) })}
                            className="bg-white"
                          />
                          {getTaxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-1">IVA {getTaxRate(l.taxId)}%</div>}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-600">Precio c/IVA</label>
                          <Input
                            type="text" inputMode="numeric"
                            value={fmtMoneyInput(String(calcWithIva(l.unitPrice ?? 0, l.taxId)))}
                            onChange={(e) => {
                              const v = moneyToNumber(e.target.value);
                              setLine(l.soLineId, { unitPrice: calcSinIva(v, l.taxId) });
                            }}
                            className="bg-white"
                          />
                          {getTaxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-1">÷ {(1 + getTaxRate(l.taxId) / 100).toFixed(2)}</div>}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-600">Desc %</label>
                          <Input
                            type="number" min={0} max={100} step="0.01"
                            value={l.discountPercent}
                            onChange={(e) => setLine(l.soLineId, { discountPercent: Number(e.target.value) })}
                            className="bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-600">TaxId</label>
                          <Input
                            type="number"
                            value={l.taxId ?? ""}
                            onChange={(e) => setLine(l.soLineId, { taxId: e.target.value ? Number(e.target.value) : null })}
                            placeholder="(opcional)"
                            className="bg-white"
                          />
                        </div>
                      </div>

                      {(isBatch || isSerial) && (
                        <div className="mt-3 text-xs text-gray-600">
                          {isBatch  && <span className="mr-4">Lote: <b>{l.batchNumber?.trim() || "—"}</b></span>}
                          {isSerial && <span>Seriales: <b>{parseSerials(l.serialNumbers).length || 0}</b> / <b>{Math.trunc(l.quantity || 0)}</b></span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Direct mode lines */}
        {mode === "direct" && (
          <div>
            <div className="space-y-3">
              {directLines.map((l) => {
                const isService = l.lineType === "SERVICE";
                const prod     = (!isService && l.productId) ? productMap.get(l.productId) : null;
                const isBatch  = !!prod?.isBatchManaged;
                const isSerial = !!prod?.isSerialManaged;
                const needsTrack = isBatch || isSerial;
                const subtotal = round2(l.quantity * l.unitPrice * (1 - (l.discountPercent || 0) / 100));

                return (
                  <div key={l.id} className={`border rounded-xl p-4 ${isService ? "bg-blue-50/40 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${isService ? "bg-blue-600 text-white" : "bg-[#C5A05A] text-white"}`}>
                        {isService ? <Wrench className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        {isService ? "SERVICIO" : "ITEM"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">

                      {/* Producto o Descripción */}
                      <div className="md:col-span-3">
                        {isService ? (
                          <>
                            <label className="text-xs font-semibold text-gray-600">Descripción <span className="text-red-500">*</span></label>
                            <Input
                              placeholder="Descripción del servicio..."
                              value={l.description}
                              onChange={(e) => setDirectLine(l.id, { description: e.target.value })}
                              className="bg-white"
                            />
                          </>
                        ) : (
                        <>
                        <label className="text-xs font-semibold text-gray-600">Producto</label>
                        <Select
                          value={l.productId ? String(l.productId) : ""}
                          onValueChange={(v) => {
                            const pid = Number(v);
                            const p   = productMap.get(pid);
                            setDirectLine(l.id, {
                              productId:  pid,
                              unitPrice:  Number(p?.price ?? 0),
                              taxId:      p?.taxId ?? null,
                              batchNumber:  "",
                              serialNumbers: "",
                            });
                          }}
                        >
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {products
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.code} — {p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        </>
                        )}
                      </div>

                      {/* Cantidad */}
                      <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                        <Input
                          type="number" min={0} step={isSerial ? 1 : "0.01"}
                          value={l.quantity}
                          onChange={(e) => setDirectLine(l.id, { quantity: Number(e.target.value), batchNumber: "", serialNumbers: "" })}
                          className="bg-white"
                        />
                      </div>

                      {/* Precio s/IVA */}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-600">Precio s/IVA</label>
                        <Input
                          type="text" inputMode="numeric"
                          value={fmtMoneyInput(String(l.unitPrice ?? ""))}
                          onChange={(e) => setDirectLine(l.id, { unitPrice: moneyToNumber(e.target.value) })}
                          className="bg-white"
                        />
                        {getTaxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-1">IVA {getTaxRate(l.taxId)}%</div>}
                      </div>

                      {/* Precio c/IVA */}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-600">Precio c/IVA</label>
                        <Input
                          type="text" inputMode="numeric"
                          value={fmtMoneyInput(String(calcWithIva(l.unitPrice ?? 0, l.taxId)))}
                          onChange={(e) => {
                            const v = moneyToNumber(e.target.value);
                            setDirectLine(l.id, { unitPrice: calcSinIva(v, l.taxId) });
                          }}
                          className="bg-white"
                        />
                        {getTaxRate(l.taxId) > 0 && <div className="text-[11px] text-gray-500 mt-1">÷ {(1 + getTaxRate(l.taxId) / 100).toFixed(2)}</div>}
                      </div>

                      {/* Desc % */}
                      <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-gray-600">Desc %</label>
                        <Input
                          type="number" min={0} max={100} step="0.01"
                          value={l.discountPercent}
                          onChange={(e) => setDirectLine(l.id, { discountPercent: Number(e.target.value) })}
                          className="bg-white"
                        />
                      </div>

                      {/* IVA */}
                      <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-gray-600">IVA</label>
                        <Select
                          value={l.taxId ? String(l.taxId) : "0"}
                          onValueChange={(v) => setDirectLine(l.id, { taxId: v && v !== "0" ? Number(v) : null })}
                        >
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Sin IVA" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="0">Sin IVA</SelectItem>
                            {taxes.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.rate}%)</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Acciones */}
                      <div className="md:col-span-2 flex gap-1 items-end">
                        {needsTrack && (
                          <Button type="button" variant="outline" size="sm" className="bg-white flex-1"
                            onClick={() => openTrackDialog(l.id, "direct")}>
                            {isBatch  && !isSerial && <Boxes   className="mr-1 h-4 w-4" />}
                            {isSerial && !isBatch  && <Barcode className="mr-1 h-4 w-4" />}
                            Tracking
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-9 w-9 p-0"
                          onClick={() => removeDirectLine(l.id)} title="Eliminar línea">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Info row */}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      {isBatch  && <span className={`px-2 py-0.5 rounded ${l.batchNumber?.trim() ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>Lote: {l.batchNumber?.trim() || "—"}</span>}
                      {isSerial && <span className={`px-2 py-0.5 rounded ${parseSerials(l.serialNumbers).length === Math.trunc(l.quantity || 0) && l.quantity > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>
                        Seriales: {parseSerials(l.serialNumbers).length}/{Math.trunc(l.quantity || 0)}
                      </span>}
                      {subtotal > 0 && <span className="ml-auto font-semibold text-gray-800">Subtotal: {money(subtotal)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {directLines.length === 0 && (
              <div className="text-gray-400 text-sm py-4 text-center border-2 border-dashed rounded-xl">
                No hay líneas. Agregá un ITEM o SERVICIO para comenzar.
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                className="border border-[#C5A05A] text-[#C5A05A] bg-white hover:bg-[#C5A05A]/10"
                variant="outline"
                onClick={() => addDirectLine("ITEM")}
              >
                <Plus className="mr-2 h-4 w-4" /> ITEM
              </Button>
              <Button
                className="border border-blue-500 text-blue-600 bg-white hover:bg-blue-50"
                variant="outline"
                onClick={() => addDirectLine("SERVICE")}
              >
                <Plus className="mr-2 h-4 w-4" /> SERVICIO
              </Button>
            </div>
          </div>
        )}
      </Card>
      )}

      {/* ── DIALOG TRACKING ── */}
      <Dialog
        open={trackOpen}
        onOpenChange={(v) => {
          setTrackOpen(v);
          if (!v) setOpenSerialPicker(false);
        }}
      >
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tracking — {dialogName}</DialogTitle>
            <DialogDescription>Seleccioná lote/serial según corresponda.</DialogDescription>
          </DialogHeader>

          {!dialogProductId ? (
            <div className="text-sm text-gray-600">Sin línea seleccionada.</div>
          ) : (
            <div className="space-y-4">
              {isBatchDialog && (
                <div className="border rounded-xl p-4 bg-gray-50 space-y-2">
                  <div className="font-semibold text-sm">Lote disponible</div>

                  <select
                    className="w-full h-10 rounded-md border px-3 bg-white"
                    value={dialogBatch ?? ""}
                    onChange={(e) => setDialogLine({ batchNumber: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.batchNumber}>
                        {b.batchNumber} (Disp: {money(b.quantity || 0)})
                      </option>
                    ))}
                  </select>

                  <div className="text-[11px] text-gray-500">Si no aparece nada, no hay stock por lote en ese depósito.</div>
                </div>
              )}

              {isSerialDialog && (
                <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
                  <div className="font-semibold text-sm">Seriales</div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white"
                      onClick={() => {
                        const qty = Math.trunc(dialogQuantity || 0);
                        if (!qty || qty <= 0) { Swal.fire("Validación", "Primero cargá la cantidad.", "warning"); return; }
                        if (!isIntegerLike(dialogQuantity)) { Swal.fire("Validación", "Producto serializado: cantidad debe ser entera.", "warning"); return; }
                        setSelectedSerials(parseSerials(dialogSerials));
                        setSerialSearch("");
                        setOpenSerialPicker(true);
                      }}
                    >
                      Seleccionar seriales
                    </Button>

                    <div className="text-sm text-gray-600">
                      Seleccionados: <b>{selectedSerials.length}</b> / <b>{Math.trunc(dialogQuantity || 0)}</b>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-600">
                    Seriales en línea: <b>{parseSerials(dialogSerials).length}</b>
                  </div>

                  {dialogQuantity > 0 && isIntegerLike(dialogQuantity) &&
                    parseSerials(dialogSerials).length !== Math.trunc(dialogQuantity) && (
                      <div className="text-[11px] text-yellow-700">⚠️ Deben coincidir (cantidad vs seriales).</div>
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

      {/* ── SERIAL PICKER ── */}
      <Dialog
        open={openSerialPicker}
        onOpenChange={(v) => {
          setOpenSerialPicker(v);
          if (!v) setSerialSearch("");
        }}
      >
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Seleccionar seriales</DialogTitle>
            <DialogDescription>Marcá exactamente la misma cantidad de seriales que la cantidad a facturar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Buscar serial..."
              value={serialSearch}
              onChange={(e) => setSerialSearch(e.target.value)}
              className="bg-white"
            />

            <div className="h-[360px] overflow-auto border rounded-md p-3 space-y-2 bg-white">
              {serialOptions
                .filter((s) => (s.serialNumber ?? "").toLowerCase().includes(serialSearch.toLowerCase().trim()))
                .map((s) => {
                  const sn          = s.serialNumber;
                  const checked     = selectedSerials.includes(sn);
                  const qty         = Math.trunc(dialogQuantity || 0);
                  const disableCheck = !checked && selectedSerials.length >= qty;

                  return (
                    <label key={s.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disableCheck}
                        onChange={(e) => {
                          const isOn = e.target.checked;
                          setSelectedSerials((prev) => {
                            if (isOn) { if (prev.length >= qty) return prev; return [...prev, sn]; }
                            return prev.filter((x) => x !== sn);
                          });
                        }}
                      />
                      <span className={disableCheck ? "text-gray-400" : ""}>{sn}</span>
                    </label>
                  );
                })}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Seleccionados: <b>{selectedSerials.length}</b> / {Math.trunc(dialogQuantity || 0)}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedSerials([]);
                    setDialogLine({ serialNumbers: "" });
                  }}
                >
                  Limpiar
                </Button>

                <Button
                  className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
                  onClick={() => {
                    const csv = selectedSerials.join(",");
                    setDialogLine({ serialNumbers: csv });
                    setOpenSerialPicker(false);
                  }}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
