"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  ArrowLeft,
  FileDown,
  Sparkles,
  BadgeCheck,
  Coins,
  CalendarClock,
  Layers3,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtPY = new Intl.NumberFormat("es-PY");
const uid = () => Math.random().toString(36).slice(2);

// =====================
// Types
// =====================
type Customer = {
  id: number;
  razonSocial: string;
  partnerType: string; // "C" cliente, "S" proveedor
  code?: string;
};
type Warehouse = { id: number; name: string };
type Product = {
  id: number;
  code: string;
  name: string;
  price?: number | null;
  taxId?: number | null;
  cost?: number | null;
};
type Tax = { id: number; name: string; rate: number };

type CreditTerm = { id: number; name: string; days: number; isActive?: boolean };

// UI payment type
type PaymentTypeUI = "Cash" | "Credit" | "Installments";
const paymentTypeToEnum = (p: PaymentTypeUI) => (p === "Cash" ? 1 : p === "Credit" ? 2 : 3);

// ===== API DTO suggest-unit-price =====
type SuggestUnitPriceRequestDto = {
  productId: number;
  customerId?: number | null;
  paymentType: number; // enum numeric
  creditTermId?: number | null;
  installmentsCount?: number | null;
  installmentIntervalDays?: number | null;
  costOverride?: number | null;
};

type SuggestUnitPriceResultDto = {
  productId: number;
  costUsed: number;
  markupPctApplied: number;
  markupAmount: number;
  unitPriceSuggested: number;
  ruleInfo?: string | null;
};

// ===== API simulate pricing options =====
type SimulateReq = {
  customerId: number;
  warehouseId: number;
  creditTermId?: number | null;
  maxInstallmentsCount: number;
  installmentIntervalDays?: number | null;
  lines: Array<{
    productId: number;
    quantity: number;
    discountPercent: number;
    taxId?: number | null;
  }>;
};

type SimulatedOptionLine = {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  costUsed: number;
  unitPriceSuggested: number;
  discountPercent: number;
  taxId?: number | null;
  taxRate: number;
  lineSubTotal: number;
  lineTax: number;
  lineTotal: number;
};

type SimulatedOption = {
  paymentType: number; // 1 cash, 2 credit, 3 installments
  creditTermId?: number | null;
  creditTermName?: string | null;
  creditDays?: number | null;

  installmentsCount?: number | null;
  installmentIntervalDays?: number | null;

  markupPctApplied: number;
  subTotal: number;
  taxTotal: number;
  total: number;

  ruleInfo?: string | null;

  lines: SimulatedOptionLine[];
};

type LineDraft = {
  _tmpId: string;
  productId: number | "";
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | "" | null;

  // pricing UX
  priceSource: "SUGGESTED" | "MANUAL";
  suggestedUnitPrice?: number | null;
  ruleInfo?: string | null;
};

type Props = {
  mode: "create" | "edit";
  editingId?: number;               // ✅ este es el prop correcto
  onSaved?: (id: number) => void;
  onCancel?: () => void;
};

type QuoteState = {
  cashTotal: number;
  creditTotal: number;
  instTotal: number;
  cashInfo?: string | null;
  creditInfo?: string | null;
  instInfo?: string | null;
};

export default function SalesOrderForm({ mode, editingId, onSaved, onCancel }: Props) {
  const router = useRouter();

  // Lookups
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [creditTerms, setCreditTerms] = useState<CreditTerm[]>([]);

  // Form cabecera
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [comments, setComments] = useState<string>("");

  const [docNumber, setDocNumber] = useState<string>("");
  const [status, setStatus] = useState<string>("DRAFT");

  // ==== Condición elegida (se guarda) ====
  const [paymentType, setPaymentType] = useState<PaymentTypeUI>("Cash");
  const [creditTermId, setCreditTermId] = useState<number | "">("");
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState<number>(30);

  // ==== Cotización SAP (3 opciones) ====
  const [quoteCreditTermId, setQuoteCreditTermId] = useState<number | "">("");
  const [quoteInstallmentsCount, setQuoteInstallmentsCount] = useState<number>(12);
  const [quoteInstallmentIntervalDays, setQuoteInstallmentIntervalDays] = useState<number>(30);

  // Descuento global para el PDF/cotización (no se guarda hasta aplicar)
  const [quoteDiscountPct, setQuoteDiscountPct] = useState<number>(0);

  // Selección de escenarios para PDF
  const [pdfSel, setPdfSel] = useState({
    cash: true,
    credit: true,
    installments: true,
  });

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const [quoteDirty, setQuoteDirty] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);

  // Líneas
  const [lines, setLines] = useState<LineDraft[]>([
    {
      _tmpId: uid(),
      productId: "",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxId: "",
      priceSource: "SUGGESTED",
      suggestedUnitPrice: null,
      ruleInfo: null,
    },
  ]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p] as const)), [products]);
  const taxMap = useMemo(() => new Map(taxes.map((t) => [t.id, t] as const)), [taxes]);

  const selectedCustomer = useMemo(() => {
    if (!customerId) return null;
    return customers.find((c) => c.id === Number(customerId)) ?? null;
  }, [customerId, customers]);

  // =====================
  // Totales del documento (con precios actuales de la línea)
  // =====================
  const totals = useMemo(() => {
    let sub = 0;
    let tax = 0;

    for (const l of lines) {
      if (!l.productId || l.quantity <= 0) continue;

      const discountFactor = (100 - (l.discountPercent || 0)) / 100;
      const lineSub = round2(l.quantity * (l.unitPrice || 0) * discountFactor);

      const tid =
        l.taxId === ""
          ? productMap.get(Number(l.productId))?.taxId ?? null
          : l.taxId;

      const rate = tid ? taxMap.get(Number(tid))?.rate ?? 0 : 0;
      const lineTax = round2(lineSub * (rate / 100));

      sub += lineSub;
      tax += lineTax;
    }

    const total = round2(sub + tax);
    return { sub: round2(sub), tax: round2(tax), total };
  }, [lines, productMap, taxMap]);

  // =====================
  // Loaders
  // =====================
  const loadLookups = async () => {
    const getCustomers = async () => {
      try {
        const r = await api.get("/sociosnegocio/clientes");
        return (r.data ?? []) as Customer[];
      } catch {
        const r = await api.get("/sociosnegocio");
        const all = (r.data ?? []) as Customer[];
        return all.filter((c) => (c.partnerType ?? "").toUpperCase() === "C");
      }
    };

    const [cust, wh, pr, tx, ct] = await Promise.all([
      getCustomers(),
      api.get("/warehouses"),
      api.get("/products"),
      api.get("/taxes"),
      api.get("/creditterms"),
    ]);

    setCustomers(cust ?? []);
    setWarehouses(wh.data ?? []);
    setProducts(pr.data ?? []);
    setTaxes(tx.data ?? []);
    setCreditTerms(ct.data ?? []);

    const terms = (ct.data ?? []) as CreditTerm[];
    const t30 = terms.find((t) => t.days === 30 && (t.isActive ?? true));
    const first = terms.find((t) => (t.isActive ?? true));
    const picked = t30?.id ?? first?.id ?? "";
    setQuoteCreditTermId(picked as any);

    if (!creditTermId && picked) setCreditTermId(picked as any);
  };

  const loadDocIfEdit = async () => {
    if (!editingId) return;

    const res = await api.get(`/salesorders/${editingId}`);
    const doc = res.data;

    if ((doc.status ?? "").toUpperCase() !== "DRAFT") {
      Swal.fire("Bloqueado", "Solo podés editar una OV en estado DRAFT.", "warning");
      router.push("/sales-orders");
      return;
    }

    setDocNumber(doc.docNumber ?? "");
    setStatus(doc.status ?? "DRAFT");
    setOrderDate((doc.orderDate ?? "").slice(0, 10));
    setCustomerId(doc.customerId);
    setWarehouseId(doc.warehouseId);
    setComments(doc.comments ?? "");

    const mapped = (doc.lines ?? []).map((l: any) => ({
      _tmpId: uid(),
      productId: l.productId,
      quantity: Number(l.quantity ?? 0),
      unitPrice: Number(l.unitPrice ?? 0),
      discountPercent: Number(l.discountPercent ?? 0),
      taxId: l.taxId ?? "",
      priceSource: "SUGGESTED" as const,
      suggestedUnitPrice: null,
      ruleInfo: null,
    }));

    setLines(
      mapped.length
        ? mapped
        : [
            {
              _tmpId: uid(),
              productId: "",
              quantity: 1,
              unitPrice: 0,
              discountPercent: 0,
              taxId: "",
              priceSource: "SUGGESTED",
              suggestedUnitPrice: null,
              ruleInfo: null,
            },
          ]
    );
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadLookups();
        await loadDocIfEdit();
      } catch (e: any) {
        Swal.fire("Error", e?.response?.data ?? "No se pudo cargar datos", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // =====================
  // Dirty flag
  // =====================
  useEffect(() => {
    setQuoteDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerId,
    warehouseId,
    quoteCreditTermId,
    quoteInstallmentsCount,
    quoteInstallmentIntervalDays,
    quoteDiscountPct,
    lines,
  ]);

  // =====================
  // Line helpers
  // =====================
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        _tmpId: uid(),
        productId: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        taxId: "",
        priceSource: "SUGGESTED",
        suggestedUnitPrice: null,
        ruleInfo: null,
      },
    ]);
  };

  const removeLine = (tmpId: string) => {
    setLines((prev) => {
      const next = prev.filter((x) => x._tmpId !== tmpId);
      return next.length
        ? next
        : [
            {
              _tmpId: uid(),
              productId: "",
              quantity: 1,
              unitPrice: 0,
              discountPercent: 0,
              taxId: "",
              priceSource: "SUGGESTED",
              suggestedUnitPrice: null,
              ruleInfo: null,
            },
          ];
    });
  };

  const setLine = (tmpId: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l._tmpId === tmpId ? { ...l, ...patch } : l)));
  };

  // =====================
  // Suggestion helpers
  // =====================
  const buildSuggestReq = (
    productId: number,
    scenario: PaymentTypeUI,
    opts?: {
      creditTermId?: number | null;
      installmentsCount?: number | null;
      installmentIntervalDays?: number | null;
    }
  ): SuggestUnitPriceRequestDto => {
    const pt = paymentTypeToEnum(scenario);

    return {
      productId,
      customerId: customerId ? Number(customerId) : null,
      paymentType: pt,
      creditTermId:
        scenario === "Credit"
          ? (opts?.creditTermId ?? (creditTermId ? Number(creditTermId) : null))
          : null,
      installmentsCount:
        scenario === "Installments"
          ? (opts?.installmentsCount ?? (Number(installmentsCount || 0) || null))
          : null,
      installmentIntervalDays:
        scenario === "Installments"
          ? (opts?.installmentIntervalDays ?? (Number(installmentIntervalDays || 0) || null))
          : null,
    };
  };

  const suggestUnitPrice = async (req: SuggestUnitPriceRequestDto) => {
    const res = await api.post<SuggestUnitPriceResultDto>("/salespricing/suggest-unit-price", req);
    return res.data;
  };

  // =====================
  // SIMULAR (3 opciones)
  // =====================
  const buildSimulatePayload = (): SimulateReq | null => {
    if (!customerId) return null;
    if (!warehouseId) return null;

    const validLines = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => {
        const prod = productMap.get(Number(l.productId));
        const tid =
          l.taxId === ""
            ? prod?.taxId ?? null
            : (l.taxId as any);

        return {
          productId: Number(l.productId),
          quantity: Number(l.quantity),
          discountPercent: Number(l.discountPercent || 0),
          taxId: tid ? Number(tid) : null,
        };
      });

    if (!validLines.length) return null;

    return {
      customerId: Number(customerId),
      warehouseId: Number(warehouseId),
      creditTermId: quoteCreditTermId ? Number(quoteCreditTermId) : null,
      maxInstallmentsCount: Number(quoteInstallmentsCount || 12),
      installmentIntervalDays: Number(quoteInstallmentIntervalDays || 30) || null,
      lines: validLines,
    };
  };

  // ✅ FIX: total por opción usando opt.lines + respetando MANUAL
  const calcTotalsFromOption = (opt: SimulatedOption) => {
    const optMap = new Map<number, SimulatedOptionLine>(opt.lines.map((x) => [x.productId, x]));
    const discQuoteFactor = (100 - (quoteDiscountPct || 0)) / 100;

    let sub = 0;
    let tax = 0;

    for (const l of lines) {
      if (!l.productId || l.quantity <= 0) continue;

      const pid = Number(l.productId);
      const prod = productMap.get(pid);

      const tid =
        l.taxId === ""
          ? prod?.taxId ?? null
          : (l.taxId as any);

      const rate = tid ? taxMap.get(Number(tid))?.rate ?? 0 : 0;

      // suggested unit comes from opt.lines
      const suggestedUnit = Number(optMap.get(pid)?.unitPriceSuggested ?? 0);

      // manual override
      const unit = l.priceSource === "MANUAL" ? Number(l.unitPrice || 0) : suggestedUnit;

      const lineDiscFactor = (100 - (l.discountPercent || 0)) / 100;

      const base = round2(Number(l.quantity) * unit * lineDiscFactor);
      const baseAfterQuoteDisc = round2(base * discQuoteFactor);

      const lineTax = round2(baseAfterQuoteDisc * (rate / 100));

      sub += baseAfterQuoteDisc;
      tax += lineTax;
    }

    return { total: round2(sub + tax), info: opt.ruleInfo ?? null };
  };

  const simulateQuote = async () => {
    const payload = buildSimulatePayload();

    if (!payload) {
      Swal.fire("Atención", "Seleccioná cliente, depósito y al menos 1 línea válida para simular.", "warning");
      return;
    }

    setQuoteLoading(true);
    try {
      const res = await api.post<SimulatedOption[]>("/salesorders/pricing-options/simulate", payload);
      const options = res.data ?? [];

      const cashOpt = options.find((o) => o.paymentType === 1);
      const creditOpt = options.find((o) => o.paymentType === 2);
      const instOpt = options.find((o) => o.paymentType === 3);

      if (!cashOpt || !creditOpt || !instOpt) {
        Swal.fire("Error", "El backend no devolvió las 3 opciones esperadas.", "error");
        return;
      }

      const cash = calcTotalsFromOption(cashOpt);
      const credit = calcTotalsFromOption(creditOpt);
      const inst = calcTotalsFromOption(instOpt);

      setQuote({
        cashTotal: cash.total,
        creditTotal: credit.total,
        instTotal: inst.total,
        cashInfo: cash.info,
        creditInfo: credit.info,
        instInfo: inst.info,
      });

      setQuoteDirty(false);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message ?? "No se pudo simular", "error");
    } finally {
      setQuoteLoading(false);
    }
  };

  // "Aplicar" fija condición y recalcula SOLO líneas no manuales (usando suggest-unit-price)
  const applyScenario = async (scenario: PaymentTypeUI) => {
    if (!customerId) {
      Swal.fire("Atención", "Seleccioná un cliente antes de aplicar.", "warning");
      return;
    }

    try {
      setLoading(true);

      const nextCreditTermId =
        scenario === "Credit" ? (quoteCreditTermId ? Number(quoteCreditTermId) : null) : null;

      const nextInstCount =
        scenario === "Installments" ? Number(quoteInstallmentsCount || 0) : null;

      const nextInstInterval =
        scenario === "Installments" ? Number(quoteInstallmentIntervalDays || 0) || null : null;

      setPaymentType(scenario);

      if (scenario === "Credit") {
        setCreditTermId((nextCreditTermId ?? "") as any);
      } else if (scenario === "Installments") {
        setInstallmentsCount(Number(nextInstCount || 0));
        setInstallmentIntervalDays(Number(nextInstInterval || 0));
      }

      const targets = lines.filter((l) => l.productId && l.quantity > 0 && l.priceSource !== "MANUAL");
      for (const l of targets) {
        const pid = Number(l.productId);

        const req = buildSuggestReq(pid, scenario, {
          creditTermId: nextCreditTermId,
          installmentsCount: nextInstCount,
          installmentIntervalDays: nextInstInterval,
        });

        const r = await suggestUnitPrice(req);

        setLine(l._tmpId, {
          unitPrice: Number(r.unitPriceSuggested || 0),
          suggestedUnitPrice: Number(r.unitPriceSuggested || 0),
          ruleInfo: r.ruleInfo ?? null,
          priceSource: "SUGGESTED",
        });
      }

      Swal.fire(
        "OK",
        `Condición aplicada: ${scenario === "Cash" ? "Contado" : scenario === "Credit" ? "Crédito" : "Cuotas"}`,
        "success"
      );
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message ?? "No se pudo aplicar", "error");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // Save
  // =====================
  const validateForm = (): string | null => {
    if (!customerId) return "Seleccioná un cliente.";
    if (!warehouseId) return "Seleccioná un depósito.";

    const validLines = lines.filter((l) => l.productId && l.quantity > 0);
    if (!validLines.length) return "Cargá al menos 1 línea con producto y cantidad > 0.";

    for (const l of validLines) {
      if (l.unitPrice < 0) return "El precio no puede ser negativo.";
      if (l.discountPercent < 0 || l.discountPercent > 100) return "El descuento debe estar entre 0 y 100.";
    }

    if (paymentType === "Credit" && !creditTermId) return "Seleccioná un término de crédito.";
    if (paymentType === "Installments" && (!installmentsCount || installmentsCount <= 0))
      return "Cantidad de cuotas inválida.";

    return null;
  };

  const buildPayload = () => ({
    orderDate: new Date(orderDate).toISOString(),
    customerId: Number(customerId),
    warehouseId: Number(warehouseId),
    comments: comments?.trim() || null,

    lines: lines
      .filter((l) => l.productId && l.quantity > 0)
      .map((l) => ({
        productId: Number(l.productId),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent || 0),
        taxId: l.taxId === "" ? null : (l.taxId as any),
      })),
  });

  const save = async () => {
    const err = validateForm();
    if (err) return Swal.fire("Validación", err, "warning");

    try {
      setLoading(true);
      const payload = buildPayload();

      if (mode === "create") {
        const res = await api.post("/salesorders", payload);
        const id = Number(res.data?.id ?? res.data ?? 0);

        Swal.fire("OK", "Orden de venta creada", "success");
        if (onSaved && id) onSaved(id);
        else router.push("/sales-orders");
      } else {
        await api.put(`/salesorders/${editingId}`, { ...payload, status: "DRAFT" });
        Swal.fire("OK", "Orden de venta actualizada", "success");
        if (onSaved && editingId) onSaved(editingId);
        else router.push("/sales-orders");
      }
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo guardar", "error");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // ✅ PDF Cotización PREVIEW (sin guardar)
  // POST: /salesorders/quote-pdf-preview
  // =====================
  const exportQuotePdf = async () => {
    if (!customerId || !warehouseId) {
      Swal.fire("Atención", "Seleccioná cliente y depósito antes de exportar.", "warning");
      return;
    }

    if (!pdfSel.cash && !pdfSel.credit && !pdfSel.installments) {
      Swal.fire("Atención", "Seleccioná al menos un escenario para exportar.", "warning");
      return;
    }

    const validLines = lines.filter((l) => l.productId && l.quantity > 0);
    if (!validLines.length) {
      Swal.fire("Atención", "Agregá al menos una línea válida.", "warning");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        orderDate: new Date(orderDate).toISOString(),
        customerId: Number(customerId),
        warehouseId: Number(warehouseId),
        comments: comments?.trim() || null,

        includeCash: pdfSel.cash,
        includeCredit: pdfSel.credit,
        includeInstallments: pdfSel.installments,

        discountPct: Number(quoteDiscountPct || 0),

        creditTermId: quoteCreditTermId ? Number(quoteCreditTermId) : null,

        installmentsCount: Number(quoteInstallmentsCount || 12),
        installmentIntervalDays: Number(quoteInstallmentIntervalDays || 30) || null,

        lines: validLines.map((l) => ({
          productId: Number(l.productId),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPercent: Number(l.discountPercent || 0),
          taxId: l.taxId === "" ? null : Number(l.taxId as any),
          priceSource: l.priceSource, // "MANUAL" o "SUGGESTED"
        })),
      };

      const res = await api.post(
        `/salesorders/quote-pdf-preview`,
        payload,
        { responseType: "blob" }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Cotizacion_Preview_${mode === "edit" && editingId ? `OV_${editingId}_` : ""}${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo generar el PDF", "error");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // UI
  // =====================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => (onCancel ? onCancel() : router.push("/sales-orders"))}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <div>
            <h1 className="text-3xl font-semibold">
              {mode === "create" ? "Nueva Orden de Venta" : `Editar Orden de Venta ${docNumber ? `(${docNumber})` : ""}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Cotización tipo SAP (Contado / Crédito / Cuotas) + precio sugerido
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={simulateQuote} disabled={quoteLoading || loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Simular
          </Button>
          <Button onClick={save} disabled={loading}>
            Guardar
          </Button>
        </div>
      </div>

      {/* CABECERA */}
      <div className="bg-white rounded-xl shadow border p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Fecha</label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>

          {/* Cliente */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Cliente</label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-full justify-between bg-white"
                >
                  {selectedCustomer
                    ? `${selectedCustomer.code ? `${selectedCustomer.code} - ` : ""}${selectedCustomer.razonSocial}`
                    : "Seleccionar cliente"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                align="start"
                className={cn(
                  "w-[--radix-popover-trigger-width] p-0 bg-white border shadow-xl rounded-md overflow-hidden"
                )}
              >
                <Command className="bg-white">
                  <div className="border-b px-2">
                    <CommandInput
                      placeholder="Buscar cliente..."
                      className={cn(
                        "h-10 border-0 bg-white shadow-none",
                        "focus-visible:ring-0 focus-visible:ring-offset-0"
                      )}
                    />
                  </div>

                  <CommandList className="max-h-64 overflow-y-auto bg-white">
                    <CommandEmpty className="py-6 text-center text-sm text-gray-500">
                      No se encontró cliente.
                    </CommandEmpty>

                    <CommandGroup>
                      {customers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.code ?? ""} ${c.razonSocial} ${c.id}`}
                          onSelect={() => {
                            setCustomerId(c.id);
                            setCustomerOpen(false);
                            setQuote(null);
                          }}
                          className="cursor-pointer aria-selected:bg-gray-100"
                        >
                          <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                          {(c.code ? `${c.code} - ` : "") + c.razonSocial}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Depósito</label>
            <Select value={warehouseId ? String(warehouseId) : ""} onValueChange={(v) => setWarehouseId(Number(v))}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Seleccione depósito" />
              </SelectTrigger>
              <SelectContent className="bg-white shadow-md">
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)} className="hover:bg-gray-100">
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condición elegida */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Condición de la OV (guardada)</label>
            <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white shadow-md">
                <SelectItem value="Cash">Contado</SelectItem>
                <SelectItem value="Credit">Crédito</SelectItem>
                <SelectItem value="Installments">Cuotas</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1">
              Consejo: el sistema sugiere precio según Parámetros de Venta, pero podés editar en la línea si el cliente negocia.
            </div>
          </div>

          {paymentType === "Credit" && (
            <div>
              <label className="text-sm font-semibold text-gray-700">Término de crédito</label>
              <Select value={creditTermId ? String(creditTermId) : ""} onValueChange={(v) => setCreditTermId(Number(v))}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Seleccione término" />
                </SelectTrigger>
                <SelectContent className="bg-white shadow-md">
                  {creditTerms
                    .filter((t) => (t.isActive ?? true))
                    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
                    .map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.days} días - {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {paymentType === "Installments" && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700">Cuotas</label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Math.min(12, Math.max(1, Number(e.target.value || 1))))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Intervalo (días)</label>
                <Input
                  type="number"
                  min={1}
                  value={installmentIntervalDays}
                  onChange={(e) => setInstallmentIntervalDays(Math.max(1, Number(e.target.value || 1)))}
                />
              </div>
            </>
          )}

          <div className="md:col-span-3">
            <label className="text-sm font-semibold text-gray-700">Comentarios</label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
      </div>

      {/* COTIZACIÓN (3 opciones) */}
      <div className="bg-[#fbf6ea] rounded-xl shadow border p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-xl font-semibold text-gray-900">Cotización (3 opciones)</div>
                {quoteDirty && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                    Simulación desactualizada
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Simulá Contado / Crédito / Cuotas para que el cliente elija. Luego “Aplicar” fija la condición en la OV.
              </div>
            </div>
          </div>

          {/* acciones derecha */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-gray-700">Desc. %</span>
              <Input
                className="w-24 bg-white"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={quoteDiscountPct}
                onChange={(e) => setQuoteDiscountPct(Number(e.target.value || 0))}
              />
            </div>

            <Button
              variant="outline"
              className="bg-white"
              onClick={simulateQuote}
              disabled={loading || quoteLoading}
              title="Simular precios por escenarios"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Simular
            </Button>

            <Button
              variant="outline"
              className="bg-white"
              onClick={exportQuotePdf}
              disabled={loading || quoteLoading}
              title="Exportar PDF PREVIEW (sin guardar)"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* selector escenarios para PDF */}
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pdfSel.cash}
              onChange={(e) => setPdfSel((s) => ({ ...s, cash: e.target.checked }))}
            />
            Incluir Contado
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pdfSel.credit}
              onChange={(e) => setPdfSel((s) => ({ ...s, credit: e.target.checked }))}
            />
            Incluir Crédito
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pdfSel.installments}
              onChange={(e) => setPdfSel((s) => ({ ...s, installments: e.target.checked }))}
            />
            Incluir Cuotas
          </label>
        </div>

        {/* cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CONTADO */}
          <div className="bg-white rounded-xl shadow border p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-green-600" />
                <div className="text-lg font-semibold">Contado</div>
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => applyScenario("Cash")}
                disabled={loading}
              >
                Aplicar
              </Button>
            </div>

            <div className="mt-4 text-4xl font-bold tracking-tight">
              {fmtPY.format(Math.round((quote?.cashTotal ?? totals.total) || 0))}
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              Total estimado (respetando líneas manuales).
            </div>
          </div>

          {/* CRÉDITO */}
          <div className="bg-white rounded-xl shadow border p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                <div className="text-lg font-semibold">Crédito</div>
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => applyScenario("Credit")}
                disabled={loading}
              >
                Aplicar
              </Button>
            </div>

            <div className="mt-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Término</div>
              <Select
                value={quoteCreditTermId ? String(quoteCreditTermId) : ""}
                onValueChange={(v) => {
                  setQuoteCreditTermId(Number(v));
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccione término..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {creditTerms
                    .filter((t) => (t.isActive ?? true))
                    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
                    .map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.days} días - {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 text-4xl font-bold tracking-tight">
              {fmtPY.format(Math.round((quote?.creditTotal ?? totals.total) || 0))}
            </div>

            <div className="mt-2 text-xs text-muted-foreground break-words">
              {quote?.creditInfo ? `CREDIT: ${quote.creditInfo}` : "CREDIT: (info se mostrará al simular)"}
            </div>
          </div>

          {/* CUOTAS */}
          <div className="bg-white rounded-xl shadow border p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-purple-600" />
                <div className="text-lg font-semibold">Cuotas</div>
              </div>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => applyScenario("Installments")}
                disabled={loading}
              >
                Aplicar
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Cuotas (máx 12)</div>
                <Input
                  className="bg-white"
                  type="number"
                  min={1}
                  max={12}
                  value={quoteInstallmentsCount}
                  onChange={(e) => setQuoteInstallmentsCount(Math.min(12, Math.max(1, Number(e.target.value || 1))))}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Intervalo (días)</div>
                <Input
                  className="bg-white"
                  type="number"
                  min={1}
                  value={quoteInstallmentIntervalDays}
                  onChange={(e) => setQuoteInstallmentIntervalDays(Math.max(1, Number(e.target.value || 1)))}
                />
              </div>
            </div>

            <div className="mt-4 text-4xl font-bold tracking-tight">
              {fmtPY.format(Math.round((quote?.instTotal ?? totals.total) || 0))}
            </div>

            <div className="mt-2 text-xs text-muted-foreground break-words">
              {quote?.instInfo ? `INSTALL: ${quote.instInfo}` : "INSTALL: (info se mostrará al simular)"}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Nota: “Aplicar” fija la condición en la OV y recalcula solo líneas <b>no manuales</b>. El PDF puede incluir 1, 2 o 3 opciones (checkboxes).
        </div>
      </div>

      {/* LÍNEAS */}
      <div className="bg-white rounded-xl shadow border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800 text-lg">Líneas</h3>
          <Button variant="outline" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" /> Agregar línea
          </Button>
        </div>

        <div className="space-y-3">
          {lines.map((l) => {
            const p = l.productId ? productMap.get(Number(l.productId)) : null;
            const defaultTaxId = p?.taxId ?? null;

            return (
              <div
                key={l._tmpId}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-gray-50 p-3 rounded-lg border"
              >
                <div className="lg:col-span-5">
                  <label className="text-xs font-semibold text-gray-600">Producto</label>
                  <Select
                    value={l.productId ? String(l.productId) : ""}
                    onValueChange={async (v) => {
                      const pid = Number(v);
                      const prod = productMap.get(pid);

                      setLine(l._tmpId, {
                        productId: pid,
                        taxId: prod?.taxId ?? "",
                        priceSource: "SUGGESTED",
                        ruleInfo: null,
                        suggestedUnitPrice: null,
                      });

                      try {
                        if (customerId) {
                          setLoading(true);
                          const r = await suggestUnitPrice(
                            buildSuggestReq(pid, paymentType, {
                              creditTermId: paymentType === "Credit" ? (creditTermId ? Number(creditTermId) : null) : null,
                              installmentsCount: paymentType === "Installments" ? Number(installmentsCount || 0) : null,
                              installmentIntervalDays: paymentType === "Installments" ? Number(installmentIntervalDays || 0) || null : null,
                            })
                          );

                          setLine(l._tmpId, {
                            unitPrice: Number(r.unitPriceSuggested || 0),
                            suggestedUnitPrice: Number(r.unitPriceSuggested || 0),
                            ruleInfo: r.ruleInfo ?? null,
                            priceSource: "SUGGESTED",
                          });
                        } else {
                          setLine(l._tmpId, { unitPrice: Number(prod?.price ?? 0) });
                        }
                      } catch (e: any) {
                        const fallback =
                          Number(prod?.cost ?? 0) > 0 ? Number(prod?.cost ?? 0)
                          : Number(prod?.price ?? 0) > 0 ? Number(prod?.price ?? 0)
                          : 0;

                        setLine(l._tmpId, { unitPrice: fallback });

                        if (fallback <= 0) {
                          Swal.fire("Atención", "Este producto no tiene costo ni precio cargado. No se puede sugerir un precio.", "warning");
                        }
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Seleccione producto" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-md">
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                  <Input
                    type="number"
                    value={l.quantity}
                    min={0}
                    step="0.01"
                    onChange={(e) => setLine(l._tmpId, { quantity: Number(e.target.value) })}
                  />
                </div>

                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">Precio</label>
                    {l.priceSource === "SUGGESTED" && (
                      <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" /> sugerido
                      </span>
                    )}
                  </div>

                  <Input
                    type="number"
                    value={l.unitPrice}
                    min={0}
                    step="0.01"
                    onChange={(e) =>
                      setLine(l._tmpId, {
                        unitPrice: Number(e.target.value),
                        priceSource: "MANUAL",
                      })
                    }
                  />

                  {l.ruleInfo && (
                    <div className="text-[11px] text-gray-500 mt-1 break-words">
                      {l.ruleInfo}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-gray-600">Desc %</label>
                  <Input
                    type="number"
                    value={l.discountPercent}
                    min={0}
                    max={100}
                    step="0.01"
                    onChange={(e) => setLine(l._tmpId, { discountPercent: Number(e.target.value) })}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Impuesto</label>
                  <Select
                    value={l.taxId === "" ? "" : String(l.taxId ?? "")}
                    onValueChange={(v) => setLine(l._tmpId, { taxId: v ? Number(v) : "" })}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={defaultTaxId ? "Por defecto" : "Seleccione"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-md">
                      {taxes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="text-[11px] text-gray-500 mt-1">
                    {defaultTaxId ? `Default prod: ${taxMap.get(defaultTaxId)?.name ?? ""}` : "Sin impuesto por defecto"}
                  </div>
                </div>

                <div className="lg:col-span-12 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeLine(l._tmpId)}
                    className="hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* TOTALES */}
        <div className="mt-6 flex flex-col items-end gap-1">
          <div className="text-sm text-gray-700">
            Subtotal: <span className="font-semibold">{fmtPY.format(totals.sub)}</span>
          </div>
          <div className="text-sm text-gray-700">
            Impuestos: <span className="font-semibold">{fmtPY.format(totals.tax)}</span>
          </div>
          <div className="text-base text-gray-900">
            Total: <span className="font-bold">{fmtPY.format(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
