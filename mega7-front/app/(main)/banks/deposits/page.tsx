"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

import {
  ArrowLeft,
  Building2,
  RefreshCcw,
  Landmark,
  Save,
  ReceiptText,
  Eye,
  HandCoins,
} from "lucide-react";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// =================== TYPES ===================
type BankAccountRow = {
  id: number;
  bankId: number;
  bankName?: string | null;
  alias: string;
  accountNumber: string;
  currency: string; // PYG, USD...
  isActive: boolean;
};

type ReceiptRow = {
  id: number;
  receiptDate: string;
  customerId: number;
  customerName: string;
  totalReceived: number;
  paymentMethod: string;
  paymentReference?: string | null;
  fiscalFullNumber?: string | null;
  isDeposited: boolean;
  depositedAt?: string | null;
  bankMovementId?: number | null;
};

// =================== HELPERS ===================
// ✅ MUI cambia según versión:
// - v5/v6: GridRowSelectionModel = GridRowId[]
// - v7+:   GridRowSelectionModel = { type, ids:Set }
function toSelectedIds(model: GridRowSelectionModel): GridRowId[] {
  // @ts-ignore - compat
  if (Array.isArray(model)) return model as GridRowId[];
  // @ts-ignore - compat
  if (model && typeof model === "object" && "ids" in model)
    // @ts-ignore - compat
    return Array.from(model.ids ?? []) as GridRowId[];
  return [];
}

function emptySelectionModel(): GridRowSelectionModel {
  // Intento v7+
  // @ts-ignore
  return { type: "include", ids: new Set<GridRowId>() } as GridRowSelectionModel;
}

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

const accLabel = (a: BankAccountRow) => {
  const bank = (a.bankName ?? "").trim();
  const alias = (a.alias ?? "").trim();
  const num = (a.accountNumber ?? "").trim();
  const cur = (a.currency ?? "PYG").trim();
  const left = bank ? `${bank} · ${alias}` : alias || `Cuenta #${a.id}`;
  return `${left}${num ? ` · ${num}` : ""} · ${cur}`;
};

export default function BankDepositsPage() {
  const [loading, setLoading] = useState(false);

  // filtros
  const [from, setFrom] = useState(() => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    return first.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  // data
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);

  // depósito form
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");

  // selección grid
  const [selection, setSelection] = useState<GridRowSelectionModel>(() =>
    emptySelectionModel()
  );

  const selectedIds = useMemo(() => toSelectedIds(selection).map((x) => Number(x)), [selection]);

  const openReceiptPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/sales-receipt/${id}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadAccounts = async () => {
    const res = await api.get(`/banks/accounts`);
    const list = Array.isArray(res.data) ? (res.data as any[]) : [];
    // normalizar: tu controller probablemente devuelve BankName dentro de Bank (Include)
    const mapped: BankAccountRow[] = list.map((x) => ({
      id: x.id,
      bankId: x.bankId,
      bankName: x.bankName ?? x.bank?.name ?? x.bank?.Name ?? "",
      alias: x.alias ?? "",
      accountNumber: x.accountNumber ?? "",
      currency: x.currency ?? "PYG",
      isActive: x.isActive !== false,
    }));
    setAccounts(mapped.filter((a) => a.isActive));

    if (!bankAccountId && mapped.filter((a) => a.isActive).length === 1) {
      setBankAccountId(mapped.filter((a) => a.isActive)[0].id);
    }
  };

  const loadUndeposited = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("pendingDeposit", "true");
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const res = await api.get(`/arsalesreceipts?${qs.toString()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setRows((data.filter(Boolean) as ReceiptRow[]) ?? []);

      // reset selection
      setSelection(emptySelectionModel());
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo cargar recaudaciones"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadUndeposited();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((r) => {
      const num = (r.fiscalFullNumber ?? "").toLowerCase();
      const cname = (r.customerName ?? "").toLowerCase();
      const ref = (r.paymentReference ?? "").toLowerCase();
      return (
        String(r.id).includes(q) ||
        num.includes(q) ||
        cname.includes(q) ||
        ref.includes(q)
      );
    });
  }, [rows, search]);

  const totalSelected = useMemo(() => {
    let sum = 0;
    for (const id of selectedIds) {
      const r = rows.find((x) => x.id === id);
      if (r) sum += Number(r.totalReceived ?? 0);
    }
    return sum;
  }, [selectedIds, rows]);

  const doDeposit = async () => {
    if (!bankAccountId) {
      return Swal.fire("Validación", "Seleccioná una cuenta bancaria destino.", "warning");
    }
    if (selectedIds.length === 0) {
      return Swal.fire("Validación", "Seleccioná al menos un recibo a depositar.", "warning");
    }

    const confirm = await Swal.fire({
      title: "Confirmar depósito",
      html: `
        <div style="text-align:left">
          <div><b>Recibos:</b> ${selectedIds.length}</div>
          <div><b>Total:</b> ${fmtPY.format(totalSelected)}</div>
          <div><b>Fecha:</b> ${date}</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, depositar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      const payload = {
        bankAccountId,
        receiptIds: selectedIds,
        date: new Date(date).toISOString(),
        reference: reference?.trim() || null,
        description: description?.trim() || null,
      };

      const res = await api.post(`/arsalesreceipts/deposit`, payload);

      const movId = res.data?.bankMovementId;
      const amount = res.data?.amount;
      const cnt = res.data?.depositedCount;

      await Swal.fire(
        "OK",
        `Depósito generado.${movId ? ` Movimiento #${movId}.` : ""} ${
          cnt ? `(${cnt} recibos)` : ""
        } ${amount ? `Total: ${fmtPY.format(amount)}` : ""}`,
        "success"
      );

      await loadUndeposited();
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo realizar el depósito"), "error");
    }
  };

  const cols: GridColDef<ReceiptRow>[] = [
    { field: "id", headerName: "ID", width: 90 },
    {
      field: "fiscalFullNumber",
      headerName: "Recibo",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (_v, row) => row.fiscalFullNumber ?? `#${row.id}`,
    },
    {
      field: "receiptDate",
      headerName: "Fecha",
      width: 120,
      valueGetter: (_v, row) => (row.receiptDate ? String(row.receiptDate).slice(0, 10) : ""),
    },
    { field: "customerName", headerName: "Cliente", minWidth: 220, flex: 1.2 },
    {
      field: "paymentMethod",
      headerName: "Método",
      width: 120,
      valueGetter: (_v, row) => (row.paymentMethod ?? "").toUpperCase(),
    },
    {
      field: "totalReceived",
      headerName: "Total",
      width: 140,
      headerAlign: "right",
      align: "right",
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<ReceiptRow>) => (
        <div className="w-full h-full flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 bg-white"
            title="Ver PDF"
            onClick={() => openReceiptPdfById(p.row.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const activeAccounts = useMemo(
    () => accounts.slice().sort((a, b) => accLabel(a).localeCompare(accLabel(b))),
    [accounts]
  );

  return (
    <PageShell
      icon={<HandCoins className="h-5 w-5 text-purple-600" />}
      title="Recaudaciones a depositar"
      subtitle="Seleccioná recibos no depositados y generá un movimiento bancario IN."
      chips={
        <>
          <Chip tone="info">Pendientes: {rows.length}</Chip>
          <Chip tone="info">Seleccionados: {selectedIds.length}</Chip>
          <Chip tone="ok">Total: {fmtPY.format(totalSelected)}</Chip>
        </>
      }
      right={
        <>
          <Link href="/banks">
            <Button variant="outline" className="bg-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          </Link>

          <Button onClick={loadUndeposited} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={doDeposit}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            disabled={selectedIds.length === 0 || !bankAccountId}
            title={!bankAccountId ? "Seleccioná una cuenta bancaria" : "Depositar"}
          >
            <Save className="mr-2 h-4 w-4" /> Depositar
          </Button>
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Landmark className="h-5 w-5 text-purple-600" />}
          title="Datos del depósito"
          subtitle="Cuenta destino, fecha y referencia."
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Cuenta bancaria destino</Label>
            <Select
              value={bankAccountId ? String(bankAccountId) : ""}
              onValueChange={(v) => setBankAccountId(v ? Number(v) : null)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Seleccionar cuenta…" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px] bg-white">
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {accLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeAccounts.length === 0 && (
              <div className="text-[11px] text-yellow-700 mt-1">
                ⚠️ No hay cuentas bancarias activas. Creá una en Bancos → Cuentas.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <div className="relative">
              <Building2 className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="date"
                className="bg-white pl-9"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input
              className="bg-white"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: Depósito efectivo / boleta..."
            />
          </div>

          <div className="space-y-2 lg:col-span-4">
            <Label>Descripción</Label>
            <Input
              className="bg-white"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Depósito recaudaciones del día"
            />
          </div>
        </div>

        <Separator className="my-5" />

        <SectionHeader
          icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
          title="Recibos no depositados"
          subtitle="Filtrá por fechas y seleccioná varios para depositar en un solo movimiento."
        />

        <Separator className="my-4" />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="w-full lg:w-[320px]">
              <Label>Buscar</Label>
              <Input
                className="bg-white"
                placeholder="Recibo / cliente / ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde</Label>
                <Input
                  type="date"
                  className="bg-white"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input
                  type="date"
                  className="bg-white"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="bg-white mt-6 lg:mt-0"
              onClick={loadUndeposited}
              disabled={loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Aplicar filtro
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-420px)] w-full">
              <DataGrid
                rows={filteredRows}
                columns={cols}
                getRowId={(r: ReceiptRow): GridRowId => r.id}
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
          Tip: este depósito genera <b>1 movimiento bancario (IN)</b> por lote y marca los recibos como depositados.
        </div>
      </Card>
    </PageShell>
  );
}
