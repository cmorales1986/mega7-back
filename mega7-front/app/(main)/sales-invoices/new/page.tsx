"use client";

import { useEffect, useMemo, useState } from "react";
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
  CreditCard,
  CalendarDays,
  ListChecks,
  Building2,
  MessageSquare,
} from "lucide-react";

// ✅ tus componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

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
  id: number; // SalesOrderLineId
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
  serialNumbers: string; // CSV
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

// ✅ Series fiscales
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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseSerials = (s: string) =>
  (s ?? "")
    .split(/[\n,;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

const isIntegerLike = (n: number) => Number.isFinite(n) && Math.trunc(n) === n;

// ===== helpers miles (Gs) =====
const fmtPY = new Intl.NumberFormat("es-PY");
const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtMoneyInput = (s: string) => {
  const d = onlyDigits(s);
  if (!d) return "";
  return fmtPY.format(Number(d));
};
const moneyToNumber = (s: string) => {
  const d = onlyDigits(s);
  return d ? Number(d) : 0;
};
const money = (n: number) => fmtPY.format(Number(n || 0));

// ===== SweetAlert safe message =====
const toErrorMessage = (e: any, fallback: string) => {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
};

// ✅ label corto para el combo (prioriza seriesName)
const seriesLabel = (s: FiscalSeries) =>
  (s.seriesName && s.seriesName.trim()) ||
  `Timbrado ${s.timbradoNumber} (${s.establishment}-${s.expeditionPoint})`;

export default function NewSalesInvoicePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // Lookups
  const [openSOs, setOpenSOs] = useState<SalesOrderOpen[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [creditTerms, setCreditTerms] = useState<CreditTerm[]>([]);
  const [creditTermId, setCreditTermId] = useState<number | null>(null);

  // ✅ fiscal series
  const [fiscalSeries, setFiscalSeries] = useState<FiscalSeries[]>([]);
  const [fiscalSeriesId, setFiscalSeriesId] = useState<number | null>(null);

  // Selection
  const [soId, setSoId] = useState<number | "">("");
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);

  // Header fields
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [comments, setComments] = useState("");

  // Payment / credit
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [creditDays, setCreditDays] = useState<number>(0);
  const [hasCreditTerm, setHasCreditTerm] = useState<boolean>(true);

  // Installments UI (solo si CREDIT)
  const [creditInstallments, setCreditInstallments] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState<number>(2);

  // Override opcional
  const [firstDueDate, setFirstDueDate] = useState<string>(""); // yyyy-mm-dd

  // esquema cuotas
  const [installmentScheduleType, setInstallmentScheduleType] = useState<
    "INTERVAL" | "DAY_OF_MONTH"
  >("INTERVAL");

  // INTERVAL
  const [intervalDays, setIntervalDays] = useState<number>(30); // ✅ DEFAULT 30

  // DAY_OF_MONTH
  const [dueDayOfMonth, setDueDayOfMonth] = useState<number>(5); // default UX
  const [firstDueRule, setFirstDueRule] = useState<"AUTO" | "NEXT_MONTH">("AUTO");

  // Lines
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);

  // Tracking dialog por línea
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackLineId, setTrackLineId] = useState<number | null>(null);
  const trackLine = useMemo(
    () => lines.find((x) => x.soLineId === trackLineId) ?? null,
    [lines, trackLineId]
  );

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ===== tracking options =====
  const [batchOptions, setBatchOptions] = useState<BatchPickDto[]>([]);
  const [serialOptions, setSerialOptions] = useState<SerialPickDto[]>([]);

  // serial picker
  const [openSerialPicker, setOpenSerialPicker] = useState(false);
  const [serialSearch, setSerialSearch] = useState("");
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);

  const loadLookups = async () => {
    try {
      const [soRes, prodRes, termRes, seriesRes] = await Promise.all([
        api.get("/salesorders/open"),
        api.get("/products"),
        api.get("/creditterms"),
        api.get("/fiscaldocumentseries?documentType=FACTURA&onlyActive=true"),
      ]);

      setOpenSOs(soRes.data ?? []);
      setProducts(prodRes.data ?? []);

      const terms: CreditTerm[] = termRes.data ?? [];
      setCreditTerms(terms.filter((t) => t.isActive));

      const series: FiscalSeries[] = seriesRes.data ?? [];
      setFiscalSeries(series);

      // default si hay una sola
      if (series.length === 1) setFiscalSeriesId(series[0].id);
      else setFiscalSeriesId(null);
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo cargar datos"), "error");
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  // mantener creditDays sincronizado con el término seleccionado (pero editable)
  useEffect(() => {
    if (!creditTermId) {
      setCreditDays(0);
      return;
    }
    const term = creditTerms.find((t) => t.id === creditTermId);
    setCreditDays(term?.days ?? 0);
  }, [creditTermId, creditTerms]);

  async function getCustomerCreditTerm(customerId: number): Promise<number | null> {
    try {
      const r = await api.get(`/sociosnegocio/${customerId}`);
      return r.data?.creditTermId ?? null;
    } catch {
      return null;
    }
  }

  const loadPending = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/salesorders/${id}/pending`);
      const doc: PendingDoc = res.data;
      setPendingDoc(doc);

      // ===== CREDIT TERM (solo sugerencia) =====
      let termId = doc?.customer?.creditTermId ?? null;
      if (!termId && doc?.customerId) {
        termId = await getCustomerCreditTerm(doc.customerId);
      }

      setCreditTermId(termId);
      setHasCreditTerm(!!termId);

      if (termId) {
        const term = creditTerms.find((t) => t.id === termId);
        setCreditDays(term?.days ?? 0);
      } else {
        setCreditDays(0); // no bloquear
      }

      // ===== CUOTAS defaults UI =====
      const suggestedN = Math.max(2, Math.trunc(doc?.customer?.defaultInstallments ?? 2));
      setInstallmentsCount(suggestedN);

      setCreditInstallments(false);

      // defaults esquema cuotas
      setInstallmentScheduleType("INTERVAL");
      setIntervalDays(30);
      setDueDayOfMonth(5);
      setFirstDueRule("AUTO");

      // ===== líneas =====
      const mapped: InvoiceLineDraft[] = (doc.lines ?? []).map((l) => ({
        soLineId: l.id,
        productId: l.productId,
        productCode: l.productCode,
        productName: l.productName,
        pendingQty: Number(l.pendingQty ?? 0),

        quantity: Number(l.pendingQty ?? 0),
        unitPrice: Number(l.unitPrice ?? 0),
        discountPercent: Number(l.discountPercent ?? 0),
        taxId: l.taxId ?? null,

        batchNumber: "",
        serialNumbers: "",
      }));
      setLines(mapped);

      // sugerencia primer vencimiento (invoiceDate + creditDays) como override opcional
      const inv = new Date(invoiceDate);
      const suggested = new Date(inv);
      const days = termId ? (creditTerms.find((t) => t.id === termId)?.days ?? 0) : 0;
      suggested.setDate(suggested.getDate() + days);
      setFirstDueDate(suggested.toISOString().slice(0, 10));
    } catch (e: any) {
      setPendingDoc(null);
      setLines([]);
      Swal.fire("Error", toErrorMessage(e, "No se pudo cargar pendientes"), "error");
    } finally {
      setLoading(false);
    }
  };

  const setLine = (soLineId: number, patch: Partial<InvoiceLineDraft>) => {
    setLines((prev) => prev.map((l) => (l.soLineId === soLineId ? { ...l, ...patch } : l)));
  };

  // Totales (estimados)
  const totals = useMemo(() => {
    let sub = 0;
    for (const l of lines) {
      if (l.quantity <= 0) continue;
      const discountFactor = (100 - (l.discountPercent || 0)) / 100;
      const lineSub = round2(l.quantity * (l.unitPrice || 0) * discountFactor);
      sub += lineSub;
    }
    return { sub: round2(sub), total: round2(sub) };
  }, [lines]);

  const computedDueDate = useMemo(() => {
    const inv = new Date(invoiceDate);
    if (!Number.isFinite(inv.getTime())) return "";

    if (paymentType === "CASH") return inv.toISOString().slice(0, 10);

    // CREDIT sin cuotas
    if (!creditInstallments) {
      const d = new Date(inv);
      d.setDate(d.getDate() + (creditDays || 0));
      return d.toISOString().slice(0, 10);
    }

    // CREDIT con cuotas
    if (firstDueDate) return firstDueDate;

    const base = new Date(inv);
    base.setDate(base.getDate() + (creditDays || 0));

    if (installmentScheduleType === "DAY_OF_MONTH") {
      const dueDay = Math.min(31, Math.max(1, dueDayOfMonth || 1));
      const year = base.getUTCFullYear();
      const month = base.getUTCMonth();

      const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const day = Math.min(dueDay, last);
      let candidate = new Date(Date.UTC(year, month, day));

      if (firstDueRule === "NEXT_MONTH") {
        const nm = new Date(Date.UTC(year, month + 1, 1));
        const last2 = new Date(
          Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth() + 1, 0)
        ).getUTCDate();
        const day2 = Math.min(dueDay, last2);
        candidate = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth(), day2));
        return candidate.toISOString().slice(0, 10);
      }

      if (base.getUTCDate() > dueDay) {
        const nm = new Date(Date.UTC(year, month + 1, 1));
        const last2 = new Date(
          Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth() + 1, 0)
        ).getUTCDate();
        const day2 = Math.min(dueDay, last2);
        candidate = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth(), day2));
      }

      return candidate.toISOString().slice(0, 10);
    }

    // INTERVAL: base = invoiceDate + creditDays
    return base.toISOString().slice(0, 10);
  }, [
    invoiceDate,
    paymentType,
    creditInstallments,
    creditDays,
    firstDueDate,
    installmentScheduleType,
    dueDayOfMonth,
    firstDueRule,
  ]);

  const installmentsPreview = useMemo(() => {
    if (paymentType !== "CREDIT" || !creditInstallments) return [];

    const n = Math.max(1, Math.trunc(installmentsCount || 1));
    const base = totals.total || 0;
    if (n <= 1) return [];

    const per = round2(base / n);

    const clampDay = (year: number, month0: number, dueDay: number) => {
      const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
      const day = Math.min(Math.max(1, dueDay), last);
      return new Date(Date.UTC(year, month0, day));
    };

    // baseDate:
    // - si user define firstDueDate => ancla ahí
    // - si no => invoiceDate + creditDays
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

      // compute first due (AUTO/NEXT_MONTH), pero si firstDueDate vino, ya estamos anclados
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
        // opcional: clamp al día elegido
        firstDue = clampDay(firstDue.getUTCFullYear(), firstDue.getUTCMonth(), dueDay);
      }

      for (let k = 1; k <= n; k++) {
        const amt = k === n ? round2(base - acc) : per;
        acc = round2(acc + amt);

        if (k === 1) {
          out.push({ n: k, due: firstDue.toISOString().slice(0, 10), amount: amt });
          continue;
        }

        const nm = new Date(
          Date.UTC(firstDue.getUTCFullYear(), firstDue.getUTCMonth() + (k - 1), 1)
        );
        const clamped = clampDay(nm.getUTCFullYear(), nm.getUTCMonth(), dueDay);
        out.push({ n: k, due: clamped.toISOString().slice(0, 10), amount: amt });
      }

      return out;
    }

    // INTERVAL
    const start = baseDate;
    for (let k = 1; k <= n; k++) {
      const amt = k === n ? round2(base - acc) : per;
      acc = round2(acc + amt);

      const due = new Date(start);
      if (k > 1) due.setDate(due.getDate() + (intervalDays || 30) * (k - 1));
      out.push({ n: k, due: due.toISOString().slice(0, 10), amount: amt });
    }

    return out;
  }, [
    paymentType,
    creditInstallments,
    installmentsCount,
    firstDueDate,
    invoiceDate,
    creditDays,
    totals.total,
    installmentScheduleType,
    intervalDays,
    dueDayOfMonth,
    firstDueRule,
  ]);

  const isLineBatch = (l: InvoiceLineDraft) => !!productMap.get(l.productId)?.isBatchManaged;
  const isLineSerial = (l: InvoiceLineDraft) => !!productMap.get(l.productId)?.isSerialManaged;

  async function loadBatchOptions(productId: number, whId: number) {
    const res = await api.get(
      `/stock/batches/${productId}?warehouseId=${whId}&onlyAvailable=true`
    );
    setBatchOptions(res.data ?? []);
  }

  async function loadSerialOptions(productId: number, whId: number) {
    const res = await api.get(`/stock/serials/${productId}?warehouseId=${whId}`);
    setSerialOptions(res.data ?? []);
  }

  const openTrackDialog = async (soLineId: number) => {
    setTrackLineId(soLineId);

    const l = lines.find((x) => x.soLineId === soLineId);
    if (!l || !pendingDoc) {
      setTrackOpen(true);
      return;
    }

    setBatchOptions([]);
    setSerialOptions([]);
    setSerialSearch("");

    setSelectedSerials(parseSerials(l.serialNumbers));

    const p = productMap.get(l.productId);
    const whId = Number(pendingDoc.warehouseId);

    try {
      if (p?.isBatchManaged) await loadBatchOptions(l.productId, whId);
      if (p?.isSerialManaged) await loadSerialOptions(l.productId, whId);
    } catch {
      Swal.fire("Aviso", "No se pudo cargar lotes/seriales disponibles.", "warning");
    }

    setTrackOpen(true);
  };

  const validate = (): string | null => {
    if (!soId) return "Seleccioná una Orden de Venta abierta.";
    if (!pendingDoc) return "No hay pendientes cargados.";
    if (!lines.length) return "No hay líneas pendientes.";

    // ✅ fiscal series requerido si hay más de una activa
    if ((fiscalSeries?.length ?? 0) > 1 && !fiscalSeriesId) {
      return "Seleccioná la Serie (Timbrado) para emitir la factura.";
    }

    const used = lines.filter((l) => l.quantity > 0);
    if (!used.length) return "Debés facturar al menos 1 línea (cantidad > 0).";

    if (paymentType === "CREDIT" && creditInstallments) {
      const n = Math.trunc(installmentsCount || 0);
      if (n < 2) return "Si activás 'Crédito a cuotas', la cantidad debe ser >= 2.";

      if (installmentScheduleType === "INTERVAL") {
        if (!intervalDays || intervalDays < 1) return "IntervalDays inválido (>= 1).";
      } else {
        if (!dueDayOfMonth || dueDayOfMonth < 1 || dueDayOfMonth > 31)
          return "Día de vencimiento inválido (1..31).";
        if (!firstDueRule) return "Seleccioná la regla de primera cuota (AUTO/NEXT_MONTH).";
      }
    }

    for (const l of used) {
      if (l.quantity < 0) return "Cantidad inválida.";
      if (l.quantity > l.pendingQty) return `La cantidad excede el pendiente en ${l.productName}.`;

      const p = productMap.get(l.productId);
      const isBatch = !!p?.isBatchManaged;
      const isSerial = !!p?.isSerialManaged;

      if (isBatch && !l.batchNumber?.trim())
        return `El producto ${l.productName} requiere lote. Cargalo desde Tracking.`;

      if (isSerial) {
        if (!isIntegerLike(l.quantity))
          return `El producto ${l.productName} es serializado. La cantidad debe ser entera.`;

        const serials = parseSerials(l.serialNumbers);
        if (!serials.length)
          return `El producto ${l.productName} requiere seriales. Cargalos desde Tracking.`;

        if (serials.length !== Math.trunc(l.quantity))
          return `Seriales no coinciden con cantidad en ${l.productName}. Cant: ${Math.trunc(
            l.quantity
          )} / Seriales: ${serials.length}`;
      }
    }

    return null;
  };

  // ✅ Abre el PDF generado desde tu endpoint de Reports
  const openPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/sales-invoice/${id}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);

    const w = window.open(url, "_blank", "noopener,noreferrer");


    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    setLoading(true);
    try {
      const usedLines = lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({
          salesOrderLineId: l.soLineId,
          quantity: Number(l.quantity),
          batchNumber: l.batchNumber?.trim() || null,
          serialNumbers: l.serialNumbers?.trim() || null,
        }));

      // ✅ FIX DTO: IntervalDays es int (no null). Default 30 si no aplica.
      const safeIntervalDays = Math.trunc(Number(intervalDays || 30)) || 30;

      const payload: any = {
        salesOrderId: Number(soId),
        invoiceDate: new Date(invoiceDate).toISOString(),
        paymentType,
        comments: comments?.trim() || null,

        // ✅ fiscal
        fiscalSeriesId: fiscalSeriesId ?? null,

        creditTermId: paymentType === "CREDIT" ? creditTermId : null,
        creditDays: paymentType === "CREDIT" ? Number(creditDays || 0) : 0,

        creditInstallments: paymentType === "CREDIT" ? !!creditInstallments : false,

        installmentsCount:
          paymentType === "CREDIT" && creditInstallments ? Math.trunc(installmentsCount || 0) : null,

        firstDueDate:
          paymentType === "CREDIT" && creditInstallments && firstDueDate
            ? new Date(firstDueDate).toISOString()
            : null,

        // ✅ siempre number (solo se usa si INTERVAL en backend)
        intervalDays: safeIntervalDays,

        // ✅ nuevos campos
        installmentScheduleType:
          paymentType === "CREDIT" && creditInstallments ? installmentScheduleType : null,

        dueDayOfMonth:
          paymentType === "CREDIT" &&
          creditInstallments &&
          installmentScheduleType === "DAY_OF_MONTH"
            ? Math.trunc(dueDayOfMonth || 0)
            : null,

        firstDueRule:
          paymentType === "CREDIT" &&
          creditInstallments &&
          installmentScheduleType === "DAY_OF_MONTH"
            ? firstDueRule
            : null,

        lines: usedLines,
      };

      // ✅ CREAR
      const res = await api.post("/salesinvoices", payload);

      // ✅ sacar id (soporta varios formatos)
      const newId =
        res?.data?.id ??
        res?.data?.invoiceId ??
        res?.data?.arInvoiceId ??
        (typeof res?.data === "number" ? res.data : null);

      // ✅ mensaje OK
      await Swal.fire("OK", "Factura de venta creada.", "success");

      // ✅ abrir PDF (no rompe si falla)
      if (newId) {
        try {
          await openPdfById(Number(newId));
        } catch {
          Swal.fire("Aviso", "La factura se creó, pero no se pudo abrir el PDF.", "warning");
        }
      }

      router.push("/sales-invoices");
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo guardar la factura"), "error");
    } finally {
      setLoading(false);
    }
  };

  const renderTrackStatus = (l: InvoiceLineDraft) => {
    const p = productMap.get(l.productId);
    const isBatch = !!p?.isBatchManaged;
    const isSerial = !!p?.isSerialManaged;

    const parts: string[] = [];
    if (isBatch) parts.push(l.batchNumber?.trim() ? "Lote: OK" : "Lote: Falta");
    if (isSerial) {
      const serials = parseSerials(l.serialNumbers);
      const ok = serials.length === Math.trunc(l.quantity || 0) && serials.length > 0;
      parts.push(ok ? "Serial: OK" : "Serial: Falta/No coincide");
    }

    if (!parts.length) return null;

    const okAll = parts.every((x) => x.includes("OK"));
    return (
      <span
        className={`ml-2 px-2 py-0.5 rounded text-xs ${
          okAll ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"
        }`}
      >
        {okAll ? "Tracking OK" : "Tracking incompleto"}
      </span>
    );
  };

  const chips = useMemo(() => {
    const used = lines.filter((l) => l.quantity > 0).length;
    const trackingNeeded = lines.filter((l) => {
      const p = productMap.get(l.productId);
      return Boolean(p?.isBatchManaged || p?.isSerialManaged);
    }).length;

    return { used, trackingNeeded };
  }, [lines, productMap]);

  const selectedFiscalSeries = useMemo(() => {
    if (!fiscalSeriesId) return null;
    return fiscalSeries.find((s) => s.id === fiscalSeriesId) ?? null;
  }, [fiscalSeries, fiscalSeriesId]);

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#C5A05A]" />}
      title="Nueva Factura de Venta"
      subtitle="Genera FV desde OV OPEN, con soporte de Tracking (lote/serial), Serie fiscal (Timbrado) y crédito a cuotas."
      chips={
        <>
          <Chip tone="neutral">Líneas: {lines.length}</Chip>
          <Chip tone="info">Facturar: {chips.used}</Chip>
          <Chip tone="neutral">Tracking: {chips.trackingNeeded}</Chip>
          <Chip tone="warn">Total est.: {money(totals.total)}</Chip>
          {pendingDoc ? <Chip tone="neutral">OV: {pendingDoc.docNumber}</Chip> : null}
          {selectedFiscalSeries ? (
            <Chip tone="neutral">{seriesLabel(selectedFiscalSeries)}</Chip>
          ) : null}
        </>
      }
      right={
        <>
          <Button onClick={() => router.push("/sales-invoices")} variant="outline">
            Volver
          </Button>

          <Button onClick={loadLookups} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={save}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            disabled={loading}
          >
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      {/* CABECERA */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ShoppingCart className="h-5 w-5 text-[#C5A05A]" />}
          title="Cabecera"
          subtitle="Seleccioná la OV, fecha, serie fiscal y comentarios."
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="text-sm font-semibold text-gray-700">Orden de Venta (OPEN)</label>
            <Select
              value={soId ? String(soId) : ""}
              onValueChange={(v) => {
                const id = Number(v);
                setSoId(id);
                loadPending(id);
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Seleccione OV abierta" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {openSOs.map((so) => (
                  <SelectItem key={so.id} value={String(so.id)}>
                    {so.docNumber} — {so.customerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Fecha Factura</label>
            <div className="relative">
              <CalendarDays className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>

          {/* ✅ Serie fiscal simple (solo nombre) */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Serie</label>
            <Select
              value={fiscalSeriesId ? String(fiscalSeriesId) : ""}
              onValueChange={(v) => setFiscalSeriesId(v ? Number(v) : null)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Seleccionar serie..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {fiscalSeries.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {seriesLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedFiscalSeries && (
              <div className="text-[11px] text-gray-500 mt-1">
                {selectedFiscalSeries.establishment}-{selectedFiscalSeries.expeditionPoint} · Timbrado{" "}
                {selectedFiscalSeries.timbradoNumber} · Próx{" "}
                {String(selectedFiscalSeries.nextNumber).padStart(7, "0")} (se reserva al guardar)
              </div>
            )}

            {fiscalSeries.length > 1 && !fiscalSeriesId && (
              <div className="text-[11px] text-yellow-700 mt-1">
                ⚠️ Hay más de una serie activa. Debés seleccionar una para facturar.
              </div>
            )}

            {fiscalSeries.length === 0 && (
              <div className="text-[11px] text-yellow-700 mt-1">
                ⚠️ No hay series fiscales activas para FACTURA. Cargá una en Series Fiscales.
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Depósito</label>
            <div className="relative">
              <Building2 className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={pendingDoc?.warehouseName ?? String(pendingDoc?.warehouseId ?? "")}
                disabled
                className="pl-9 bg-white"
              />
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="text-sm font-semibold text-gray-700">Comentarios</label>
            <div className="relative">
              <MessageSquare className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Observaciones..."
                className="pl-9 bg-white"
              />
            </div>
          </div>
        </div>

        {/* PAGO / CRÉDITO / CUOTAS */}
        <Separator className="my-5" />

        <SectionHeader
          icon={<CreditCard className="h-5 w-5 text-[#C5A05A]" />}
          title="Condición de pago"
          subtitle="Contado / Crédito, término, días y (opcional) crédito a cuotas."
        />

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-semibold text-gray-700">Tipo de pago</label>
              <Select
                value={paymentType}
                onValueChange={(v) => {
                  const nv = v === "CREDIT" ? "CREDIT" : "CASH";
                  setPaymentType(nv);
                  if (nv === "CASH") setCreditInstallments(false);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="CASH">CONTADO</SelectItem>
                  <SelectItem value="CREDIT">CRÉDITO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Vencimiento (estimado)</label>
              <Input value={computedDueDate} disabled className="bg-white" />

              {paymentType === "CREDIT" && !creditTermId && (
                <div className="text-[11px] text-yellow-700 mt-1">
                  ⚠️ El cliente no tiene CreditTerm asignado. Se usará crédito 0 días (no bloquea).
                </div>
              )}
              {paymentType === "CREDIT" && !!creditTermId && !hasCreditTerm && (
                <div className="text-[11px] text-yellow-700 mt-1">
                  ⚠️ No se pudo leer CreditTerm del cliente desde el pending, pero ya lo recuperamos por ID.
                </div>
              )}
            </div>

            {paymentType === "CREDIT" && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Término de crédito</label>
                  <Select
                    value={creditTermId ? String(creditTermId) : ""}
                    onValueChange={(v) => setCreditTermId(v ? Number(v) : null)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {creditTerms.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.days} días)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mt-2">
                    <label className="text-[11px] font-semibold text-gray-600">
                      Días (editable por factura)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={creditDays}
                      onChange={(e) => setCreditDays(Number(e.target.value))}
                      className="bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 select-none mt-6 md:mt-0">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#C5A05A]"
                      checked={creditInstallments}
                      onChange={(e) => setCreditInstallments(e.target.checked)}
                    />
                    <span className="text-sm font-semibold text-gray-700">Crédito a cuotas</span>
                  </label>

                  <div className="text-[11px] text-gray-500 mt-1">
                    Si desactivás cuotas, se usa vencimiento normal (invoiceDate + creditDays).
                  </div>
                </div>
              </div>
            )}
          </div>

          {paymentType === "CREDIT" && creditInstallments && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Cantidad de cuotas</label>
                <Input
                  type="number"
                  min={2}
                  step={1}
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Esquema</label>
                <Select
                  value={installmentScheduleType}
                  onValueChange={(v) =>
                    setInstallmentScheduleType(v === "DAY_OF_MONTH" ? "DAY_OF_MONTH" : "INTERVAL")
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="INTERVAL">Intervalo (cada X días)</SelectItem>
                    <SelectItem value="DAY_OF_MONTH">Día fijo del mes</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-[11px] text-gray-500 mt-1">
                  Podés dejar FirstDueDate vacío y el sistema calcula desde la factura + días de crédito.
                </div>
              </div>

              {installmentScheduleType === "INTERVAL" ? (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Intervalo (días)</label>
                  <Select value={String(intervalDays)} onValueChange={(v) => setIntervalDays(Number(v))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="7">7</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="md:col-span-1">
                  <label className="text-sm font-semibold text-gray-700">Vence día</label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={dueDayOfMonth}
                    onChange={(e) => setDueDayOfMonth(Number(e.target.value))}
                    className="bg-white"
                  />

                  <div className="text-[11px] text-gray-500 mt-1">
                    Si el mes no tiene ese día (ej 31), cae al último día del mes.
                  </div>
                </div>
              )}

              {installmentScheduleType === "DAY_OF_MONTH" ? (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Primera cuota</label>
                  <Select
                    value={firstDueRule}
                    onValueChange={(v) => setFirstDueRule(v === "NEXT_MONTH" ? "NEXT_MONTH" : "AUTO")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="AUTO">Este mes si no pasó</SelectItem>
                      <SelectItem value="NEXT_MONTH">Siempre próximo mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div />
              )}

              <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Primer Dia Vencimiendo (opcional)
                  </label>
                  <Input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="bg-white"
                  />
                  <div className="text-[11px] text-gray-500 mt-1">
                    Si lo dejás vacío, se calcula con InvoiceDate + CreditDays.
                  </div>
                </div>

                <div className="bg-gray-50 border rounded-xl p-3">
                  <div className="text-sm font-semibold text-gray-800">Preview cuotas</div>
                  {installmentsPreview.length === 0 ? (
                    <div className="text-xs text-gray-500 mt-1">
                      Cargá cantidad &gt;= 2 para ver preview.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1 text-xs text-gray-700">
                      {installmentsPreview.slice(0, 5).map((x) => (
                        <div key={x.n} className="flex justify-between">
                          <span>
                            #{x.n} — {x.due}
                          </span>
                          <span>{money(x.amount)}</span>
                        </div>
                      ))}
                      {installmentsPreview.length > 5 && (
                        <div className="text-[11px] text-gray-500">
                          …y {installmentsPreview.length - 5} más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* LÍNEAS */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5 text-[#C5A05A]" />}
          title="Líneas pendientes"
          subtitle="Editá cantidades, precios, descuentos y completá tracking si aplica."
          right={
            <div className="text-sm text-gray-600">
              Total estimado: <b>{money(totals.total)}</b>
            </div>
          }
        />

        <Separator className="my-4" />

        {!pendingDoc && (
          <div className="text-gray-500">Seleccioná una OV abierta para cargar los pendientes.</div>
        )}

        {!!pendingDoc && (
          <div className="space-y-4">
            {lines.map((l) => {
              const p = productMap.get(l.productId);
              const isBatch = !!p?.isBatchManaged;
              const isSerial = !!p?.isSerialManaged;

              return (
                <div key={l.soLineId} className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {l.productName}{" "}
                        <span className="text-xs text-gray-500">({l.productCode})</span>
                        {renderTrackStatus(l)}
                      </div>
                      <div className="text-xs text-gray-600">
                        Pendiente: <b>{l.pendingQty}</b> (OV Line ID: {l.soLineId})
                        {isBatch && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            Lote
                          </span>
                        )}
                        {isSerial && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                            Serial
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {(isBatch || isSerial) && (
                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white"
                          onClick={() => openTrackDialog(l.soLineId)}
                        >
                          {isBatch && !isSerial && <Boxes className="mr-2 h-4 w-4" />}
                          {isSerial && !isBatch && <Barcode className="mr-2 h-4 w-4" />}
                          Tracking
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Cantidad a facturar</label>
                      <Input
                        type="number"
                        min={0}
                        step={isSerial ? 1 : "0.01"}
                        value={l.quantity}
                        onChange={(e) => setLine(l.soLineId, { quantity: Number(e.target.value) })}
                        className="bg-white"
                      />
                      {isSerial && !isIntegerLike(l.quantity) && l.quantity > 0 && (
                        <div className="text-[11px] text-yellow-700 mt-1">
                          Serializado: cantidad debe ser entera.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600">Precio</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={fmtMoneyInput(String(l.unitPrice ?? ""))}
                        onChange={(e) =>
                          setLine(l.soLineId, { unitPrice: moneyToNumber(e.target.value) })
                        }
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600">Desc %</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={l.discountPercent}
                        onChange={(e) =>
                          setLine(l.soLineId, { discountPercent: Number(e.target.value) })
                        }
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600">TaxId</label>
                      <Input
                        type="number"
                        value={l.taxId ?? ""}
                        onChange={(e) =>
                          setLine(l.soLineId, { taxId: e.target.value ? Number(e.target.value) : null })
                        }
                        placeholder="(opcional)"
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {(isBatch || isSerial) && (
                    <div className="mt-3 text-xs text-gray-600">
                      {isBatch && (
                        <span className="mr-4">
                          Lote: <b>{l.batchNumber?.trim() || "—"}</b>
                        </span>
                      )}
                      {isSerial && (
                        <span>
                          Seriales: <b>{parseSerials(l.serialNumbers).length || 0}</b> /{" "}
                          <b>{Math.trunc(l.quantity || 0)}</b>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* DIALOG TRACKING */}
      <Dialog
        open={trackOpen}
        onOpenChange={(v) => {
          setTrackOpen(v);
          if (!v) setOpenSerialPicker(false);
        }}
      >
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tracking — {trackLine?.productName ?? ""}</DialogTitle>
            <DialogDescription>Seleccioná lote/serial según corresponda.</DialogDescription>
          </DialogHeader>

          {!trackLine ? (
            <div className="text-sm text-gray-600">Sin línea seleccionada.</div>
          ) : (
            <div className="space-y-4">
              {isLineBatch(trackLine) && (
                <div className="border rounded-xl p-4 bg-gray-50 space-y-2">
                  <div className="font-semibold text-sm">Lote disponible</div>

                  <select
                    className="w-full h-10 rounded-md border px-3 bg-white"
                    value={trackLine.batchNumber ?? ""}
                    onChange={(e) => setLine(trackLine.soLineId, { batchNumber: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.batchNumber}>
                        {b.batchNumber} (Disp: {money(b.quantity || 0)})
                      </option>
                    ))}
                  </select>

                  <div className="text-[11px] text-gray-500">
                    Si no aparece nada, no hay stock por lote en ese depósito.
                  </div>
                </div>
              )}

              {isLineSerial(trackLine) && (
                <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
                  <div className="font-semibold text-sm">Seriales</div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white"
                      onClick={() => {
                        const qty = Math.trunc(trackLine.quantity || 0);
                        if (!qty || qty <= 0) {
                          Swal.fire("Validación", "Primero cargá la cantidad.", "warning");
                          return;
                        }
                        if (!isIntegerLike(trackLine.quantity)) {
                          Swal.fire("Validación", "Producto serializado: cantidad debe ser entera.", "warning");
                          return;
                        }
                        setSelectedSerials(parseSerials(trackLine.serialNumbers));
                        setSerialSearch("");
                        setOpenSerialPicker(true);
                      }}
                    >
                      Seleccionar seriales
                    </Button>

                    <div className="text-sm text-gray-600">
                      Seleccionados: <b>{selectedSerials.length}</b> /{" "}
                      <b>{Math.trunc(trackLine.quantity || 0)}</b>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-600">
                    Seriales en línea: <b>{parseSerials(trackLine.serialNumbers).length}</b>
                  </div>

                  {trackLine.quantity > 0 &&
                    isIntegerLike(trackLine.quantity) &&
                    parseSerials(trackLine.serialNumbers).length !== Math.trunc(trackLine.quantity) && (
                      <div className="text-[11px] text-yellow-700">
                        ⚠️ Deben coincidir (cantidad vs seriales).
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SERIAL PICKER */}
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
            <DialogDescription>
              Marcá exactamente la misma cantidad de seriales que la cantidad a facturar.
            </DialogDescription>
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
                .filter((s) =>
                  (s.serialNumber ?? "").toLowerCase().includes(serialSearch.toLowerCase().trim())
                )
                .map((s) => {
                  const sn = s.serialNumber;
                  const checked = selectedSerials.includes(sn);
                  const qty = trackLine ? Math.trunc(trackLine.quantity || 0) : 0;
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
                            if (isOn) {
                              if (prev.length >= qty) return prev;
                              return [...prev, sn];
                            }
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
                Seleccionados: <b>{selectedSerials.length}</b> /{" "}
                {trackLine ? Math.trunc(trackLine.quantity || 0) : 0}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedSerials([]);
                    if (trackLine) setLine(trackLine.soLineId, { serialNumbers: "" });
                  }}
                >
                  Limpiar
                </Button>

                <Button
                  className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
                  onClick={() => {
                    if (trackLine) {
                      const csv = selectedSerials.join(",");
                      setLine(trackLine.soLineId, { serialNumbers: csv });
                    }
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
