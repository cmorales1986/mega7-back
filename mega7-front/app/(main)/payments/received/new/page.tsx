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

import { ArrowLeft, Save, ReceiptText, RefreshCcw, Sparkles } from "lucide-react";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// =================== TYPES ===================
type Customer = {
  id: number;
  razonSocial: string;
  ruc?: string | null;
};

type InvoiceRow = {
  id: number;
  customerId: number;
  customerName: string;

  docNumber: string;
  fiscalFullNumber?: string | null;

  invoiceDate?: string | null;
  dueDate?: string | null;

  total: number;
  balance: number;
  status: string;

  paymentType?: string | null; // CASH / CREDIT (si lo devuelve el API)
  installmentsCount?: number | null;
};

type InstallmentRow = {
  id: number;
  arInvoiceId: number;
  number: number; // 1..N
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  isPaid: boolean;
};

// =================== HELPERS ===================

// ✅ SweetAlert: asegurar string
const toErrorMessage = (e: any, fallback: string) => {
  const data = e?.response?.data;

  if (!data) return fallback;
  if (typeof data === "string") return data;

  if (typeof data?.message === "string") return data.message;

  // ASP.NET ProblemDetails
  if (typeof data?.title === "string" && typeof data?.detail === "string") {
    return `${data.title}\n${data.detail}`;
  }
  if (typeof data?.title === "string") return data.title;

  if (data?.errors && typeof data.errors === "object") {
    try {
      const lines: string[] = [];
      for (const k of Object.keys(data.errors)) {
        const arr = (data.errors as any)[k];
        if (Array.isArray(arr)) lines.push(`${k}: ${arr.join(", ")}`);
        else lines.push(`${k}: ${String(arr)}`);
      }
      if (lines.length) return lines.join("\n");
    } catch {}
  }

  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
};

// ✅ MUI selection model cambia según versión:
// - v5/v6: GridRowSelectionModel = GridRowId[]
// - v7+:   GridRowSelectionModel = { type, ids:Set }
function toSelectedIds(model: GridRowSelectionModel): GridRowId[] {
  // @ts-ignore - compat
  if (Array.isArray(model)) return model as GridRowId[];
  // @ts-ignore - compat
  if (model && typeof model === "object" && "ids" in model)
    // @ts-ignore - compat
    return Array.from((model as any).ids ?? []) as GridRowId[];
  return [];
}

function emptySelectionModel(): GridRowSelectionModel {
  // Intento v7+
  // @ts-ignore
  return { type: "include", ids: new Set<GridRowId>() } as GridRowSelectionModel;
}

// =================== PAGE ===================
export default function NewReceivedPaymentPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);

  const [method, setMethod] = useState<
    "CASH" | "TRANSFER" | "CARD" | "CHECK" | "OTHER"
  >("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ selection model (compat v5/v6/v7)
  const [selection, setSelection] = useState<GridRowSelectionModel>(() =>
    emptySelectionModel()
  );

  // IDs seleccionados como number[]
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

  const openReceiptPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/sales-receipt/${id}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get(`/sociosnegocio/clientes`);
      const data = Array.isArray(res.data) ? res.data : [];
      setCustomers((data.filter(Boolean) as Customer[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo cargar clientes"), "error");
    }
  };

  const loadInvoicesForCustomer = async (cid: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/arinvoices?includeCancelled=false`);
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      const list: InvoiceRow[] = (data.filter(Boolean) as InvoiceRow[])
        .filter((x) => x.customerId === cid)
        .filter((x) => (x.status ?? "OPEN").toUpperCase() !== "CANCELLED")
        .filter((x) => Number(x.balance ?? 0) > 0);

      setRows(list);

      // reset
      setSelection(emptySelectionModel());
      setApplyMap({});
      setInstallmentsMap({});
      setTargetInstallmentMap({});
      setApplyExcessToNextMap({});
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo cargar facturas"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const customerOptions = useMemo(() => {
    return customers
      .slice()
      .sort((a, b) => (a.razonSocial ?? "").localeCompare(b.razonSocial ?? ""));
  }, [customers]);

  const totalToApply = useMemo(() => {
    return selectedIds.reduce((acc, id) => acc + (applyMap[id] ?? 0), 0);
  }, [selectedIds, applyMap]);

  const ensureInstallmentsLoaded = async (invoiceId: number) => {
    if (installmentsMap[invoiceId]) return;

    try {
      const res = await api.get(`/arinvoices/${invoiceId}/installments`);
      const data = Array.isArray(res.data) ? res.data : [];
      setInstallmentsMap((prev) => ({
        ...prev,
        [invoiceId]: (data as InstallmentRow[]) ?? [],
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
    if (!customerId) return "Seleccioná un cliente.";
    if (selectedIds.length === 0) return "Seleccioná al menos una factura.";

    for (const id of selectedIds) {
      const inv = rows.find((x) => x.id === id);
      if (!inv) return "Factura inválida.";

      const amt = Number(applyMap[id] ?? 0);
      if (amt <= 0)
        return `El monto aplicado debe ser > 0 (Factura ${
          inv.fiscalFullNumber ?? inv.docNumber
        }).`;
      if (amt > Number(inv.balance ?? 0))
        return `El monto aplicado excede el saldo (Factura ${
          inv.fiscalFullNumber ?? inv.docNumber
        }).`;
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    const lines = selectedIds.map((invId) => ({
      arInvoiceId: invId,
      appliedAmount: Number(applyMap[invId] ?? 0),
      targetInstallmentId: targetInstallmentMap[invId] ?? null,
      applyExcessToNext: applyExcessToNextMap[invId] ?? false,
    }));

    try {
      const res = await api.post(`/arsalesreceipts`, {
        customerId,
        paymentMethod: method,
        paymentReference: reference?.trim() || null,
        notes: notes?.trim() || null,
        lines,
      });

      const receiptId = (res.data?.receiptId ?? res.data?.id ?? null) as
        | number
        | null;
      const alwaysPrint = !!res.data?.alwaysPrint;

      if (!receiptId) {
        await Swal.fire("OK", "Cobro registrado.", "success");
        window.location.href = "/payments/received";
        return;
      }

      if (alwaysPrint) {
        await openReceiptPdfById(receiptId);
      } else {
        const r = await Swal.fire({
          title: "Cobro registrado",
          text: "¿Desea imprimir recibo?",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Sí, imprimir",
          cancelButtonText: "No",
        });
        if (r.isConfirmed) await openReceiptPdfById(receiptId);
      }

      await Swal.fire("OK", "Cobro registrado.", "success");
      window.location.href = "/payments/received";
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo registrar cobro"), "error");
    }
  };

  const cols: GridColDef<InvoiceRow>[] = [
    {
      field: "fiscalFullNumber",
      headerName: "Factura",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (_v, row) => row.fiscalFullNumber ?? row.docNumber ?? "",
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
      renderCell: (p: GridRenderCellParams<InvoiceRow>) => {
        const invId = p.row.id;
        const value = applyMap[invId] ?? 0;

        return (
          <Input
            className="bg-white"
            value={value === 0 ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
              const n = Number(raw || 0);
              setApplyMap((prev) => ({ ...prev, [invId]: isNaN(n) ? 0 : n }));
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
      renderCell: (p: GridRenderCellParams<InvoiceRow>) => {
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
                  .filter((x) => !x.isPaid && Number(x.balance ?? 0) > 0)
                  .map((x) => (
                    <SelectItem key={x.id} value={String(x.id)}>
                      Cuota #{x.number} · Vence {String(x.dueDate).slice(0, 10)} ·
                      Saldo {fmtPY.format(Number(x.balance ?? 0))}
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

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title="Nuevo cobro"
      subtitle="Seleccioná cliente, facturas y el monto a aplicar. Se genera un recibo."
      chips={
        <>
          <Chip tone="info">Facturas: {rows.length}</Chip>
          <Chip tone="info">Seleccionadas: {selectedIds.length}</Chip>
          <Chip tone="ok">Total aplicar: {fmtPY.format(totalToApply)}</Chip>
        </>
      }
      right={
        <>
          <Link href="/payments/received">
            <Button variant="outline" className="bg-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          </Link>

          <Button
            onClick={save}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
          >
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Sparkles className="h-5 w-5 text-purple-600" />}
          title="Datos del cobro"
          subtitle="Seleccioná el cliente para cargar sus facturas pendientes."
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Cliente</Label>
            <Select
              value={customerId ? String(customerId) : ""}
              onValueChange={(v) => {
                const id = Number(v);
                setCustomerId(id);
                loadInvoicesForCustomer(id);
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Seleccionar cliente…" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px] bg-white">
                {customerOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.razonSocial} {c.ruc ? `· ${c.ruc}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input
              className="bg-white"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2 lg:col-span-4">
            <Label>Notas</Label>
            <Input
              className="bg-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-gray-600">
            Seleccioná facturas y definí el monto a aplicar.
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
              onClick={() => customerId && loadInvoicesForCustomer(customerId)}
              disabled={!customerId || loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Recargar
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-360px)] w-full">
              <DataGrid
                rows={rows}
                columns={cols}
                getRowId={(r: InvoiceRow): GridRowId => r.id}
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
          Tip: si seleccionás una cuota, el pago va a esa cuota. Si marcás “Si
          sobra…”, el excedente corre a próximas cuotas.
        </div>
      </Card>
    </PageShell>
  );
}
