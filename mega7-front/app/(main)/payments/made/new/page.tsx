"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ✅ Dialog (shadcn)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridRenderCellParams,
  GridRowId,
  GridRowSelectionModel,
} from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import {
  ArrowLeft,
  Save,
  HandCoins,
  RefreshCcw,
  Sparkles,
  Eye,
} from "lucide-react";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// =================== TYPES ===================
type Supplier = {
  id: number;
  razonSocial: string;
  ruc?: string | null;
};

type PaymentConcept = {
  id: number;
  name: string;
  code?: string | null;

  // ✅ backend real
  requiresBusinessPartner?: boolean;

  // (compat si existiera)
  requiresSupplier?: boolean;
};

type APInvoiceRow = {
  id: number;

  supplierId: number;
  supplierName: string;

  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;

  total: number;
  balance: number;
  status: string;

  fiscalFullNumber?: string | null;
  installmentsCount?: number | null;

  sourceType?: string | null; // SERVICE / STOCK / etc (si lo exponés)
};

type InstallmentRow = {
  id: number;
  apInvoiceId: number;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
};

type APInvoiceDetail = {
  id: number;
  purchaseReceiptId?: number | null;
  supplierId: number;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  total: number;
  balance: number;
  status: string;
  sourceType?: string | null;
  notes?: string | null;
};

type APInvoiceLine = {
  id: number;
  apInvoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};


// compat selection model (v5/v6/v7)
function toSelectedIds(model: GridRowSelectionModel): GridRowId[] {
  // @ts-ignore
  if (Array.isArray(model)) return model as GridRowId[];
  // @ts-ignore
  if (model && typeof model === "object" && "ids" in model)
    // @ts-ignore
    return Array.from((model as any).ids ?? []) as GridRowId[];
  return [];
}
function emptySelectionModel(): GridRowSelectionModel {
  // @ts-ignore
  return { type: "include", ids: new Set<GridRowId>() } as GridRowSelectionModel;
}

// money input helpers
const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtMoneyInput = (s: string) => {
  const d = onlyDigits(s);
  if (!d) return "";
  return fmtPY.format(Number(d));
};
const parseMoneyInput = (s: string) => {
  const d = onlyDigits(s);
  return d ? Number(d) : 0;
};

// =================== PAGE ===================
export default function NewPaymentMadePage() {
  const [concepts, setConcepts] = useState<PaymentConcept[]>([]);
  const [conceptId, setConceptId] = useState<number | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);

  // ✅ modo: aplicar a facturas (crédito) vs sin facturas (contado)
  const [applyToInvoices, setApplyToInvoices] = useState(true);

  const [method, setMethod] = useState<
    "CASH" | "TRANSFER" | "CARD" | "CHECK" | "OTHER"
  >("CASH");

  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // sin facturas: total manual obligatorio
  const [manualTotalUI, setManualTotalUI] = useState("");

  const [rows, setRows] = useState<APInvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selection, setSelection] = useState<GridRowSelectionModel>(() =>
    emptySelectionModel()
  );

  const selectedIds = useMemo(() => {
    return toSelectedIds(selection).map((x) => Number(x));
  }, [selection]);

  const [applyMap, setApplyMap] = useState<Record<number, number>>({});

  const [installmentsMap, setInstallmentsMap] = useState<
    Record<number, InstallmentRow[]>
  >({});
  const [targetInstallmentMap, setTargetInstallmentMap] = useState<
    Record<number, number | null>
  >({});
  const [applyExcessToNextMap, setApplyExcessToNextMap] = useState<
    Record<number, boolean>
  >({});

  // ======= MODAL FACTURA =======
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewDoc, setViewDoc] = useState<APInvoiceDetail | null>(null);
  const [viewLines, setViewLines] = useState<APInvoiceLine[]>([]);

  const openInvoiceModal = async (id: number) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewId(id);
    setViewDoc(null);
    setViewLines([]);

    try {
      // 1) cabecera
      const docRes = await api.get(`/apinvoices/${id}`);
      const d = docRes.data ?? null;

      const mappedDoc: APInvoiceDetail | null = d
        ? {
            id: Number(d.id ?? d.Id ?? 0),
            purchaseReceiptId: d.purchaseReceiptId ?? d.PurchaseReceiptId ?? null,
            supplierId: Number(d.supplierId ?? d.SupplierId ?? 0),
            supplierName: String(d.supplierName ?? d.SupplierName ?? ""),
            invoiceNumber: String(d.invoiceNumber ?? d.InvoiceNumber ?? ""),
            invoiceDate: d.invoiceDate ?? d.InvoiceDate ?? null,
            dueDate: d.dueDate ?? d.DueDate ?? null,
            total: Number(d.total ?? d.Total ?? 0),
            balance: Number(d.balance ?? d.Balance ?? 0),
            status: String(d.status ?? d.Status ?? "OPEN"),
            sourceType: d.sourceType ?? d.SourceType ?? null,
            notes: d.notes ?? d.Notes ?? null,
          }
        : null;

      setViewDoc(mappedDoc);

      // 2) líneas (si existe endpoint)
      try {
        const linesRes = await api.get(`/apinvoices/${id}/lines`);
        const arr = Array.isArray(linesRes.data) ? linesRes.data : [];
        const mappedLines: APInvoiceLine[] = (arr.filter(Boolean) as any[]).map(
          (x) => ({
            id: Number(x.id ?? x.Id ?? 0),
            apInvoiceId: Number(x.apInvoiceId ?? x.APInvoiceId ?? id),
            description: String(x.description ?? x.Description ?? ""),
            quantity: Number(x.quantity ?? x.Quantity ?? 0),
            unitPrice: Number(x.unitPrice ?? x.UnitPrice ?? 0),
            lineTotal: Number(x.lineTotal ?? x.LineTotal ?? 0),
          })
        );
        setViewLines(mappedLines);
      } catch {
        setViewLines([]);
      }
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar la factura"), "error");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const openPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/payment-made/${id}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadConcepts = async () => {
    try {
      const res = await api.get(`/paymentconcepts`);
      const data = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setConcepts((data.filter(Boolean) as PaymentConcept[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar conceptos"), "error");
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await api.get(`/sociosnegocio/proveedores`);
      const data = Array.isArray(res.data) ? res.data : [];
      setSuppliers((data.filter(Boolean) as Supplier[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar proveedores"), "error");
    }
  };

  const loadInvoicesForSupplier = async (sid: number) => {
    setLoading(true);
    try {
      const res = await api.get(
        `/apinvoices?includeCancelled=false&supplierId=${sid}&onlyWithBalance=true`
      );

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      const mapped: APInvoiceRow[] = (data.filter(Boolean) as any[]).map((x) => ({
        id: Number(x.id ?? x.Id ?? 0),
        supplierId: Number(x.supplierId ?? x.SupplierId ?? 0),
        supplierName: String(x.supplierName ?? x.SupplierName ?? ""),

        invoiceNumber: String(x.invoiceNumber ?? x.InvoiceNumber ?? ""),
        invoiceDate: x.invoiceDate ?? x.InvoiceDate ?? null,
        dueDate: x.dueDate ?? x.DueDate ?? null,

        total: Number(x.total ?? x.Total ?? 0),
        balance: Number(x.balance ?? x.Balance ?? 0),
        status: String(x.status ?? x.Status ?? "OPEN"),

        fiscalFullNumber: x.fiscalFullNumber ?? x.FiscalFullNumber ?? null,
        installmentsCount: x.installmentsCount ?? x.InstallmentsCount ?? null,

        sourceType: x.sourceType ?? x.SourceType ?? null,
      }));

      const list = mapped
        .filter((x) => x.supplierId === sid)
        .filter((x) => String(x.status ?? "OPEN").toUpperCase() !== "CANCELLED")
        .filter((x) => Number(x.balance ?? 0) > 0);

      setRows(list);

      setSelection(emptySelectionModel());
      setApplyMap({});
      setInstallmentsMap({});
      setTargetInstallmentMap({});
      setApplyExcessToNextMap({});
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar facturas CxP"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConcepts();
    loadSuppliers();
  }, []);

  const conceptOptions = useMemo(() => {
    return concepts
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [concepts]);

  const supplierOptions = useMemo(() => {
    return suppliers
      .slice()
      .sort((a, b) => (a.razonSocial ?? "").localeCompare(b.razonSocial ?? ""));
  }, [suppliers]);

  const selectedConcept = useMemo(() => {
    return conceptId ? concepts.find((c) => c.id === conceptId) ?? null : null;
  }, [conceptId, concepts]);

  const conceptIsSupplier = useMemo(() => {
    const code = String(selectedConcept?.code ?? "").toUpperCase().trim();
    const name = String(selectedConcept?.name ?? "").toLowerCase().trim();

    if (typeof selectedConcept?.requiresBusinessPartner === "boolean")
      return selectedConcept.requiresBusinessPartner;

    if (typeof selectedConcept?.requiresSupplier === "boolean")
      return selectedConcept.requiresSupplier;

    if (code === "SUPPLIER") return true;
    if (name.includes("proveedor")) return true;

    return false;
  }, [selectedConcept]);

  useEffect(() => {
    // solo resetea proveedor y facturas cuando cambia el concepto; NO toca applyToInvoices
    setSupplierId(null);
    setRows([]);
    setSelection(emptySelectionModel());
    setApplyMap({});
    setInstallmentsMap({});
    setTargetInstallmentMap({});
    setApplyExcessToNextMap({});
    setManualTotalUI("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const totalToApply = useMemo(() => {
    return selectedIds.reduce((acc, id) => acc + (applyMap[id] ?? 0), 0);
  }, [selectedIds, applyMap]);

  const ensureInstallmentsLoaded = async (invoiceId: number) => {
    if (installmentsMap[invoiceId]) return;

    try {
      const res = await api.get(`/apinvoices/${invoiceId}/installments`);
      const data = Array.isArray(res.data) ? res.data : [];

      const mapped: InstallmentRow[] = (data.filter(Boolean) as any[]).map((x) => ({
        id: Number(x.id ?? x.Id ?? 0),
        apInvoiceId: Number(x.apInvoiceId ?? x.APInvoiceId ?? 0),
        installmentNo: Number(x.installmentNo ?? x.InstallmentNo ?? 0),
        dueDate: String(x.dueDate ?? x.DueDate ?? ""),
        amount: Number(x.amount ?? x.Amount ?? 0),
        paidAmount: Number(x.paidAmount ?? x.PaidAmount ?? 0),
        balance: Number(x.balance ?? x.Balance ?? 0),
        status: String(x.status ?? x.Status ?? "OPEN"),
      }));

      setInstallmentsMap((prev) => ({
        ...prev,
        [invoiceId]: mapped,
      }));
    } catch {
      setInstallmentsMap((prev) => ({ ...prev, [invoiceId]: [] }));
    }
  };

  const applyFullBalances = () => {
    const next = { ...applyMap };
    for (const id of selectedIds) {
      const inv = rows.find((x) => x.id === id);
      if (!inv) continue;
      next[id] = Number(inv.balance ?? 0);
    }
    setApplyMap(next);
  };

  const validate = (): string | null => {
    if (!conceptId) return "Seleccioná un concepto (Proveedor / Sueldos / IPS / etc.).";

    if (applyToInvoices) {
      if (!supplierId) return "Seleccioná un proveedor.";
      if (selectedIds.length === 0) return "Seleccioná al menos una factura.";

      for (const id of selectedIds) {
        const inv = rows.find((x) => x.id === id);
        if (!inv) return "Factura inválida.";

        const amt = Number(applyMap[id] ?? 0);
        if (amt <= 0)
          return `El monto aplicado debe ser > 0 (Factura ${
            inv.fiscalFullNumber ?? inv.invoiceNumber
          }).`;
        if (amt > Number(inv.balance ?? 0))
          return `El monto aplicado excede el saldo (Factura ${
            inv.fiscalFullNumber ?? inv.invoiceNumber
          }).`;
      }
      return null;
    }

    const manualTotal = parseMoneyInput(manualTotalUI);
    if (manualTotal <= 0) return "El total debe ser mayor a 0.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    const applies = applyToInvoices
      ? selectedIds.map((invId) => ({
          apInvoiceId: invId,
          amount: Number(applyMap[invId] ?? 0),
          targetInstallmentId: targetInstallmentMap[invId] ?? null,
          applyExcessToNext: applyExcessToNextMap[invId] ?? false,
        }))
      : [];

    const supplier = supplierId ? suppliers.find((s) => s.id === supplierId) : null;
    const manualTotal = parseMoneyInput(manualTotalUI);

    try {
      const res = await api.post(`/paymentsmade`, {
        paymentDate: null,
        paymentConceptId: conceptId,
        supplierId: supplierId ?? null,
        payeeName: supplier?.razonSocial ?? null,
        method,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        totalAmount: applyToInvoices ? 0 : manualTotal,
        applies,
      });

      const id = (res.data?.id ?? null) as number | null;

      // if (id && applyToInvoices) await openPdfById(id);

      await Swal.fire("OK", "Pago registrado.", "success");
      window.location.href = "/payments/made";
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo registrar pago"), "error");
    }
  };

  const cols: GridColDef<APInvoiceRow>[] = [
    {
      field: "actions",
      headerName: "",
      width: 60,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<APInvoiceRow>) => (
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 bg-white"
          title="Ver detalle"
          onClick={() => openInvoiceModal(p.row.id)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
    {
      field: "invoiceNumber",
      headerName: "Factura",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (_v, row) => row.fiscalFullNumber ?? row.invoiceNumber ?? "",
    },
    {
      field: "invoiceDate",
      headerName: "Fecha",
      width: 120,
      valueGetter: (_v, row) =>
        row.invoiceDate ? String(row.invoiceDate).slice(0, 10) : "",
    },
    {
      field: "balance",
      headerName: "Saldo",
      width: 130,
      headerAlign: "right",
      align: "right",
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "apply",
      headerName: "Aplicar",
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: (p: GridRenderCellParams<APInvoiceRow>) => {
        const invId = p.row.id;
        const value = applyMap[invId] ?? 0;

        return (
          <Input
            className="bg-white"
            value={value === 0 ? "" : fmtMoneyInput(String(value))}
            onChange={(e) => {
              const n = parseMoneyInput(e.target.value);
              setApplyMap((prev) => ({ ...prev, [invId]: n }));
            }}
            placeholder="0"
          />
        );
      },
    },
    {
      field: "installment",
      headerName: "Cuota (opcional)",
      minWidth: 260,
      flex: 1,
      sortable: false,
      filterable: false,
      renderCell: (p: GridRenderCellParams<APInvoiceRow>) => {
        const invId = p.row.id;
        const list = installmentsMap[invId] ?? [];
        const current = targetInstallmentMap[invId];

        return (
          <div className="w-full">
            <Select
              value={current ? String(current) : "NONE"}
              onOpenChange={(open) => {
                if (open) ensureInstallmentsLoaded(invId);
              }}
              onValueChange={(v) => {
                setTargetInstallmentMap((prev) => ({
                  ...prev,
                  [invId]: v === "NONE" ? null : Number(v),
                }));
              }}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="(auto / FIFO)" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px] bg-white">
                <SelectItem value="NONE">(auto / FIFO)</SelectItem>

                {list
                  .filter(
                    (x: any) =>
                      String(x.status ?? "").toUpperCase() !== "PAID" &&
                      Number(x.balance ?? 0) > 0
                  )
                  .map((x: any) => (
                    <SelectItem key={x.id} value={String(x.id)}>
                      Cuota #{Number(x.installmentNo ?? 0)} · Vence{" "}
                      {String(x.dueDate).slice(0, 10)} · Saldo{" "}
                      {fmtPY.format(Number(x.balance ?? 0))}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="mt-1 flex items-center gap-2">
              <input
                id={`excess-${invId}`}
                type="checkbox"
                className="h-4 w-4"
                checked={!!applyExcessToNextMap[invId]}
                onChange={(e) =>
                  setApplyExcessToNextMap((prev) => ({
                    ...prev,
                    [invId]: e.target.checked,
                  }))
                }
              />
              <label
                htmlFor={`excess-${invId}`}
                className="text-xs text-gray-600 select-none"
              >
                Si sobra, aplicar a próximas cuotas
              </label>
            </div>
          </div>
        );
      },
    },
  ];

  const selectedSupplier = supplierId
    ? suppliers.find((s) => s.id === supplierId) ?? null
    : null;

  return (
    <>
      <PageShell
        icon={<HandCoins className="h-5 w-5 text-purple-600" />}
        title="Nuevo pago (CxP)"
        subtitle="Pagos a proveedores con facturas (crédito), o pagos sin facturas (sueldos/IPS/impuestos)."
        chips={
          <>
            <Chip tone="info">Facturas: {rows.length}</Chip>
            <Chip tone="info">Seleccionadas: {selectedIds.length}</Chip>
            <Chip tone="ok">Total aplicar: {fmtPY.format(totalToApply)}</Chip>
          </>
        }
        right={
          <>
            <Link href="/payments/made">
              <Button variant="outline" className="bg-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
              </Button>
            </Link>

            <Button
              onClick={save}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            >
              <Save className="mr-2 h-4 w-4" /> Guardar
            </Button>
          </>
        }
      >
        <Card className="border-slate-200 p-6 shadow-sm">
          <SectionHeader
            icon={<Sparkles className="h-5 w-5 text-purple-600" />}
            title="Datos del pago"
            subtitle="Elegí el concepto. Si es Proveedor, aplicás a facturas. Si no, registrás un pago directo."
          />

          <Separator className="my-4" />

          {/* TIPO DE PAGO — visible siempre, controla el modo */}
          <div className="mb-4 flex gap-2">
            {(["invoices", "direct"] as const).map((m) => {
              const isActive = m === "invoices" ? applyToInvoices : !applyToInvoices;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const next = m === "invoices";
                    setApplyToInvoices(next);
                    setSelection(emptySelectionModel());
                    setApplyMap({});
                    setInstallmentsMap({});
                    setTargetInstallmentMap({});
                    setApplyExcessToNextMap({});
                    setRows([]);
                    setManualTotalUI("");
                    if (next && supplierId) loadInvoicesForSupplier(supplierId);
                  }}
                  className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#2563eb] text-white border-[#2563eb]"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {m === "invoices" ? "Aplicar a Facturas" : "Pago Directo"}
                </button>
              );
            })}
            <span className="self-center text-xs text-gray-500 ml-2">
              {applyToInvoices
                ? "Seleccioná un proveedor y sus facturas pendientes."
                : "Pago sin facturas: sueldos, IPS, impuestos, otros."}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* CONCEPTO */}
            <div className="space-y-2 lg:col-span-2">
              <Label>Concepto *</Label>
              <Select
                value={conceptId ? String(conceptId) : ""}
                onValueChange={(v) => setConceptId(Number(v))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar concepto…" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px] bg-white">
                  {conceptOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* MÉTODO */}
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="CARD">Tarjeta</SelectItem>
                  <SelectItem value="CHECK">Cheque</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* REFERENCIA */}
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                className="bg-white"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* NOTAS */}
            <div className="space-y-2 lg:col-span-4">
              <Label>Notas</Label>
              <Input
                className="bg-white"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* PROVEEDOR */}
            <div className="space-y-2 lg:col-span-2">
              <Label>Proveedor {applyToInvoices ? "(requerido)" : "(opcional)"}</Label>

              <Select
                value={supplierId ? String(supplierId) : ""}
                onValueChange={(v) => {
                  const id = Number(v);
                  setSupplierId(id);
                  if (applyToInvoices) loadInvoicesForSupplier(id);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar proveedor…" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px] bg-white">
                  {supplierOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.razonSocial} {s.ruc ? `· ${s.ruc}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {supplierId && (
                <div className="text-xs text-gray-600">
                  Seleccionado: <b>{selectedSupplier?.razonSocial}</b>
                </div>
              )}
            </div>


            {/* TOTAL MANUAL (sin facturas) */}
            {!applyToInvoices && (
              <div className="space-y-2 lg:col-span-2">
                <Label>Total (sin facturas)</Label>
                <Input
                  className="bg-white"
                  inputMode="numeric"
                  value={manualTotalUI}
                  onChange={(e) => setManualTotalUI(fmtMoneyInput(e.target.value))}
                  placeholder="0"
                />
                <div className="text-xs text-gray-600">
                  Este total es el importe del pago (sueldos/IPS/impuestos/otro o pago directo).
                </div>
              </div>
            )}
          </div>

          {/* FACTURAS */}
          {applyToInvoices && (
            <>
              <Separator className="my-4" />

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-gray-600">
                  Seleccioná facturas CxP y definí el monto a aplicar. Podés ver el detalle con el botón 👁.
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={applyFullBalances}
                    disabled={selectedIds.length === 0}
                  >
                    Aplicar saldo completo
                  </Button>

                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={() => supplierId && loadInvoicesForSupplier(supplierId)}
                    disabled={!supplierId || loading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" /> Recargar
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="rounded-xl border bg-white p-2">
                <ThemeProvider theme={muiTheme}>
                  <div className="h-[calc(100vh-420px)] w-full">
                    <DataGrid
                      rows={rows}
                      columns={cols}
                      getRowId={(r: APInvoiceRow): GridRowId => r.id}
                      loading={loading}
                      checkboxSelection
                      disableRowSelectionOnClick
                      rowSelectionModel={selection}
                      onRowSelectionModelChange={(m) => setSelection(m)}
                      pageSizeOptions={[5, 10, 20, 50]}
                      initialState={{
                        pagination: { paginationModel: { pageSize: 10, page: 0 } },
                      }}
                      slots={{ toolbar: GridToolbar }}
                      slotProps={{ toolbar: { showQuickFilter: true } }}
                    />
                  </div>
                </ThemeProvider>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                Tip: si seleccionás una cuota, el pago va a esa cuota. Si marcás “Si sobra…”, el excedente corre a próximas cuotas.
              </div>
            </>
          )}
        </Card>
      </PageShell>

      {/* ======= MODAL DETALLE FACTURA ======= */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Detalle de factura</DialogTitle>
            <DialogDescription>
              {viewDoc
                ? `Proveedor: ${viewDoc.supplierName} · Factura: ${viewDoc.invoiceNumber}`
                : viewId
                ? `Factura #${viewId}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <div className="py-6 text-sm text-gray-600">Cargando...</div>
          ) : !viewDoc ? (
            <div className="py-6 text-sm text-gray-600">No se pudo cargar.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Fecha</div>
                  <div className="text-sm font-semibold">
                    {viewDoc.invoiceDate ? String(viewDoc.invoiceDate).slice(0, 10) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Vencimiento</div>
                  <div className="text-sm font-semibold">
                    {viewDoc.dueDate ? String(viewDoc.dueDate).slice(0, 10) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Tipo</div>
                  <div className="text-sm font-semibold">
                    {String(viewDoc.sourceType ?? "—")}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Estado</div>
                  <div className="text-sm font-semibold">{String(viewDoc.status ?? "OPEN")}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Total</div>
                  <div className="text-sm font-semibold">{fmtPY.format(Number(viewDoc.total ?? 0))}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Saldo</div>
                  <div className="text-sm font-semibold">{fmtPY.format(Number(viewDoc.balance ?? 0))}</div>
                </div>
              </div>

              {viewDoc.notes ? (
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-gray-600">Notas</div>
                  <div className="text-sm">{viewDoc.notes}</div>
                </div>
              ) : null}

              <Separator />

              <div>
                <div className="text-sm font-semibold text-gray-900">Líneas</div>
                <div className="text-xs text-gray-600">
                  (Solo aplica si la factura tiene líneas cargadas, por ejemplo SERVICE).
                </div>

                {viewLines.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-600">Sin líneas.</div>
                ) : (
                  <div className="mt-3 rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2">Descripción</th>
                          <th className="text-right p-2 w-[90px]">Cant.</th>
                          <th className="text-right p-2 w-[140px]">Unit.</th>
                          <th className="text-right p-2 w-[140px]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewLines.map((l) => (
                          <tr key={l.id} className="border-t">
                            <td className="p-2">{l.description}</td>
                            <td className="p-2 text-right">{Number(l.quantity ?? 0)}</td>
                            <td className="p-2 text-right">{fmtPY.format(Number(l.unitPrice ?? 0))}</td>
                            <td className="p-2 text-right">{fmtPY.format(Number(l.lineTotal ?? 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}