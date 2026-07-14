"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  RefreshCcw,
  Eye,
  Ban,
  RotateCcw,
  ReceiptText,
  HandCoins,
  List,
  FilePlus,
} from "lucide-react";

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type ARInvoiceRow = {
  id: number;
  salesOrderId: number | null;
  customerId: number;
  customerName: string;

  docNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;

  total: number;
  balance: number;

  status: string;

  isCancelled?: boolean;
  isOverdue?: boolean;

  cancelledAt?: string | null;
  cancelReason?: string | null;
};

const normStatus = (row: ARInvoiceRow): string => {
  const st = String(row.status ?? "OPEN").toUpperCase().trim();
  if (st === "CANCELLED") return "CANCELLED";
  if (st === "PAID") return "PAID";
  if (st === "PARTIAL") return "PARTIAL";
  return "OPEN";
};

const StatusBadge = ({ row }: { row: ARInvoiceRow }) => {
  const st = normStatus(row);

  const cls =
    st === "CANCELLED"
      ? "bg-gray-600"
      : st === "PAID"
      ? "bg-green-600"
      : st === "PARTIAL"
      ? "bg-amber-500"
      : "bg-blue-600";

  return <span className={`px-3 py-1 rounded-md text-white ${cls}`}>{st}</span>;
};

const OverdueBadge = ({ overdue }: { overdue: boolean }) => (
  <span
    className={`px-3 py-1 rounded-md text-white ${
      overdue ? "bg-red-600" : "bg-gray-500"
    }`}
  >
    {overdue ? "VENCIDA" : "OK"}
  </span>
);

export default function ARInvoicesPage() {
  const [rows, setRows] = useState<ARInvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);

  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "OPEN" | "PARTIAL" | "PAID" | "CANCELLED"
  >("ALL");

  const [typeFilter, setTypeFilter] = useState<"ALL" | "FACTURAS" | "CUOTAS">("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const includeCancelled = showCancelled ? "true" : "false";
      const statusParam = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";

      const res = await api.get(
        `/arinvoices?includeCancelled=${includeCancelled}${statusParam}`
      );

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as ARInvoiceRow[]) ?? []);
    } catch (e: any) {
      Swal.fire(
        "Error",
        toErrorMsg(e, "No se pudo cargar Cuentas por Cobrar"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCancelled, statusFilter]);

  const filteredRows = useMemo(() => {
    let base = rows;

    if (typeFilter === "FACTURAS") base = base.filter((r) => !String(r.docNumber ?? "").startsWith("CIMP-"));
    else if (typeFilter === "CUOTAS") base = base.filter((r) => String(r.docNumber ?? "").startsWith("CIMP-"));

    const q = search.toLowerCase().trim();
    if (!q) return base;

    return base.filter((r) => {
      return (
        String(r.docNumber ?? "").toLowerCase().includes(q) ||
        String(r.customerName ?? "").toLowerCase().includes(q) ||
        String(r.salesOrderId ?? "").toLowerCase().includes(q) ||
        String(r.id ?? "").toLowerCase().includes(q) ||
        String(r.status ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  // ===== Si querés mantener cancel/reopen (auditoría) =====
  const cancelInvoice = async (id: number) => {
    const { value } = await Swal.fire({
      title: "Cancelar CxC",
      input: "text",
      inputLabel: "Motivo (opcional)",
      inputPlaceholder: "Ej: anulación / error / devolución...",
      showCancelButton: true,
      confirmButtonText: "Cancelar CxC",
      cancelButtonText: "Volver",
    });

    if (value === undefined) return;

    try {
      await api.post(`/arinvoices/${id}/cancel`, { reason: value || null });
      Swal.fire("OK", "CxC cancelada.", "success");
      loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cancelar"), "error");
    }
  };

  const reopenInvoice = async (id: number) => {
    const { value } = await Swal.fire({
      title: "Reabrir CxC",
      input: "text",
      inputLabel: "Motivo (opcional)",
      inputPlaceholder: "Ej: reactivación...",
      showCancelButton: true,
      confirmButtonText: "Reabrir",
      cancelButtonText: "Volver",
    });

    if (value === undefined) return;

    try {
      await api.post(`/arinvoices/${id}/reopen`, { reason: value || null });
      Swal.fire("OK", "CxC reabierta.", "success");
      loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo reabrir"), "error");
    }
  };

  const canCancel = usePermission("ARInvoices.Cancel");
  const canReopen = usePermission("ARInvoices.Reopen");

  const cols: GridColDef<ARInvoiceRow>[] = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "docNumber", headerName: "N°", width: 140 },
    { field: "customerName", headerName: "Cliente", flex: 1, minWidth: 220 },
    {
      field: "invoiceDate",
      headerName: "Fecha",
      width: 120,
      valueGetter: (_v, row) =>
        row.invoiceDate ? String(row.invoiceDate).slice(0, 10) : "",
    },
    {
      field: "dueDate",
      headerName: "Venc.",
      width: 120,
      valueGetter: (_v, row) =>
        row.dueDate ? String(row.dueDate).slice(0, 10) : "",
    },
    {
      field: "status",
      headerName: "Estado",
      width: 140,
      headerAlign: "center",
      align: "center",
      valueGetter: (_v, row) => normStatus(row),
      renderCell: (p) => <StatusBadge row={p.row} />,
    },
    {
      field: "isOverdue",
      headerName: "Vencida",
      width: 120,
      headerAlign: "center",
      align: "center",
      sortable: false,
      filterable: false,
      renderCell: (p) => <OverdueBadge overdue={!!p.row.isOverdue} />,
    },
    {
      field: "total",
      headerName: "Total",
      width: 130,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "balance",
      headerName: "Saldo",
      width: 130,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 140,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<ARInvoiceRow>) => {
        const st = normStatus(p.row);
        const canCancelRow = st !== "CANCELLED" && st !== "PAID" && st !== "PARTIAL";

        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            {/* ✅ VER detalle (consulta) */}
            <Link href={`/ar-invoices/${p.row.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                title="Ver"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>

            {/* ✅ mantener cancel/reopen si querés */}
            {st !== "CANCELLED" ? (
              canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 bg-white"
                  title="Cancelar CxC"
                  onClick={() => cancelInvoice(p.row.id)}
                  disabled={!canCancelRow}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )
            ) : (
              canReopen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 bg-white"
                  title="Reabrir CxC"
                  onClick={() => reopenInvoice(p.row.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )
            )}
          </div>
        );
      },
    },
  ];

  // ========= CHIPS =========
  const totalCount = rows.length;
  const openCount = rows.filter((r) => normStatus(r) === "OPEN").length;
  const partialCount = rows.filter((r) => normStatus(r) === "PARTIAL").length;
  const paidCount = rows.filter((r) => normStatus(r) === "PAID").length;
  const cancelledCount = rows.filter((r) => normStatus(r) === "CANCELLED").length;
  const overdueCount = rows.filter((r) => !!r.isOverdue && normStatus(r) !== "CANCELLED").length;
  const cuotasCount = rows.filter((r) => String(r.docNumber ?? "").startsWith("CIMP-")).length;
  const facturasCount = rows.filter((r) => !String(r.docNumber ?? "").startsWith("CIMP-")).length;

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title="Listado de Facturas x Estado (Consulta)"
      subtitle="Listado/estado de facturas: OPEN, PARTIAL, PAID y vencimientos. Los cobros se registran en Pagos."
      chips={
        <>
          <Chip tone="info">Total: {totalCount}</Chip>
          <Chip tone="neutral">Facturas: {facturasCount}</Chip>
          <Chip tone="neutral">Con Cuotas: {cuotasCount}</Chip>
          <Chip tone="warn">OPEN: {openCount}</Chip>
          <Chip tone="info">PARTIAL: {partialCount}</Chip>
          <Chip tone="ok">PAID: {paidCount}</Chip>
          <Chip tone={cancelledCount > 0 ? "warn" : "neutral"}>CANCELLED: {cancelledCount}</Chip>
          <Chip tone={overdueCount > 0 ? "warn" : "neutral"}>Vencidas: {overdueCount}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Link href="/payments/received">
            <Button variant="outline" className="bg-white">
              <List className="mr-2 h-4 w-4" /> Cobros recibidos
            </Button>
          </Link>

          <Link href="/payments/received/new">
            <Button variant="outline" className="bg-white">
              <HandCoins className="mr-2 h-4 w-4" /> Nuevo cobro
            </Button>
          </Link>

          <Link href="/sales-invoices/new">
            <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow">
              <FilePlus className="mr-2 h-4 w-4" /> Nueva Factura
            </Button>
          </Link>
        </>
      }
    >
      <Card className="border-slate-200 p-4 shadow-sm">
        <SectionHeader
          icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
          title="Listado de Facturas x Estado"
          subtitle="Buscá por número/cliente/estado y filtrá por OPEN/PARTIAL/PAID/CANCELLED."
        />

        <Separator className="my-4" />

        {/* Tabs tipo */}
        <div className="flex gap-2 flex-wrap mb-1">
          {(["ALL", "FACTURAS", "CUOTAS"] as const).map((t) => {
            const label = t === "ALL" ? `Todas (${totalCount})` : t === "FACTURAS" ? `Facturas (${facturasCount})` : `Con Cuotas (${cuotasCount})`;
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar (factura, cliente, estado, id...)"
            className="max-w-xl bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Estado</label>
              <select
                className="h-10 rounded-md border px-3 bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">Todos</option>
                <option value="OPEN">OPEN</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="showCancelled"
                type="checkbox"
                className="h-4 w-4"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
              />
              <label htmlFor="showCancelled" className="text-sm text-gray-700 select-none">
                Ver canceladas
              </label>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-320px)] w-full">
              <DataGrid
                rows={filteredRows}
                columns={cols}
                getRowId={(r: ARInvoiceRow): GridRowId => r.id}
                loading={loading}
                pageSizeOptions={[5, 10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
              />
            </div>
          </ThemeProvider>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Tip: “Saldo” queda 0 cuando esté PAID. CANCELLED se mantiene para auditoría.
        </div>
      </Card>
    </PageShell>
  );
}
