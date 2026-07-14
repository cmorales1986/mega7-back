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
import { RefreshCcw, FileDown, Eye, ReceiptText, List, HandCoins, FilePlus } from "lucide-react";

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

// Export
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type APInvoiceStatus = "OPEN" | "PARTIAL" | "PAID" | "CANCELLED" | string;

type APInvoiceRow = {
  id: number;
  purchaseReceiptId: number;
  supplierId: number;
  supplierName: string;

  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;

  total: number;
  balance: number;

  status: APInvoiceStatus;
  createdAt?: string | null;
  updatedAt?: string | null;

  isCancelled?: boolean;
  isPaid?: boolean;
  isPartial?: boolean;
  isOpen?: boolean;
  isOverdue?: boolean;

  cancelledAt?: string | null;
  cancelReason?: string | null;
};

const normStatus = (row: APInvoiceRow): string => {
  const st = String(row.status ?? "OPEN").toUpperCase().trim();
  if (st === "CANCELLED") return "CANCELLED";
  if (st === "PAID") return "PAID";
  if (st === "PARTIAL") return "PARTIAL";
  return "OPEN";
};

const StatusBadge = ({ row }: { row: APInvoiceRow }) => {
  const st = normStatus(row);

  // mismo criterio visual que AR (más limpio)
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
  <span className={`px-3 py-1 rounded-md text-white ${overdue ? "bg-red-600" : "bg-gray-500"}`}>
    {overdue ? "VENCIDA" : "OK"}
  </span>
);

export default function APInvoicesPage() {
  const [rows, setRows] = useState<APInvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);

  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "OPEN" | "PARTIAL" | "PAID" | "CANCELLED"
  >("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const includeCancelled = showCancelled ? "true" : "false";
      const statusParam = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";

      const res = await api.get(`/apinvoices?includeCancelled=${includeCancelled}${statusParam}`);

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as APInvoiceRow[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar Cuentas por Pagar"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCancelled, statusFilter]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.invoiceNumber ?? "").toLowerCase().includes(q) ||
        String(r.supplierName ?? "").toLowerCase().includes(q) ||
        String(r.purchaseReceiptId ?? "").toLowerCase().includes(q) ||
        String(r.id ?? "").toLowerCase().includes(q) ||
        String(r.status ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  // ========= EXPORT =========
  const exportExcel = () => {
    const data = filteredRows.map((x) => ({
      id: x.id,
      purchaseReceiptId: x.purchaseReceiptId,
      supplier: x.supplierName,
      invoiceNumber: x.invoiceNumber,
      invoiceDate: x.invoiceDate ? String(x.invoiceDate).slice(0, 10) : "",
      dueDate: x.dueDate ? String(x.dueDate).slice(0, 10) : "",
      total: x.total ?? 0,
      balance: x.balance ?? 0,
      status: normStatus(x),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CxP");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "CuentasPorPagar.xlsx");
  };

  const exportCSV = () => {
    const data = filteredRows.map((x) => ({
      id: x.id,
      purchaseReceiptId: x.purchaseReceiptId,
      supplier: x.supplierName,
      invoiceNumber: x.invoiceNumber,
      invoiceDate: x.invoiceDate ? String(x.invoiceDate).slice(0, 10) : "",
      dueDate: x.dueDate ? String(x.dueDate).slice(0, 10) : "",
      total: x.total ?? 0,
      balance: x.balance ?? 0,
      status: normStatus(x),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "CuentasPorPagar.csv");
  };

  const canCreate = usePermission("APInvoices.Create");

  // ========= DATAGRID COLUMNS =========
  const cols: GridColDef<APInvoiceRow>[] = [
    { field: "id", headerName: "ID", width: 80 },
    {
      field: "purchaseReceiptId",
      headerName: "Recepción",
      width: 110,
      headerAlign: "center",
      align: "center",
    },
    { field: "supplierName", headerName: "Proveedor", flex: 1, minWidth: 220 },
    { field: "invoiceNumber", headerName: "Factura", width: 160 },
    {
      field: "invoiceDate",
      headerName: "Fecha",
      width: 120,
      valueGetter: (_v, row) => (row.invoiceDate ? String(row.invoiceDate).slice(0, 10) : ""),
    },
    {
      field: "dueDate",
      headerName: "Venc.",
      width: 120,
      valueGetter: (_v, row) => (row.dueDate ? String(row.dueDate).slice(0, 10) : ""),
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
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<APInvoiceRow>) => (
        <div className="w-full h-full flex items-center justify-center gap-2">
          <Link href={`/ap-invoices/${p.row.id}`}>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white" title="Ver">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  // ========= CHIPS =========
  const total = rows.length;
  const open = rows.filter((r) => normStatus(r) === "OPEN").length;
  const partial = rows.filter((r) => normStatus(r) === "PARTIAL").length;
  const paid = rows.filter((r) => normStatus(r) === "PAID").length;
  const cancelled = rows.filter((r) => normStatus(r) === "CANCELLED").length;
  const overdue = rows.filter((r) => !!r.isOverdue && normStatus(r) !== "CANCELLED").length;

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title="Listado de Facturas x Estado (Consulta)"
      subtitle="CxP por estado (OPEN/PARTIAL/PAID) y vencimientos. Los pagos se registran en Pagos Realizados."
      chips={
        <>
          <Chip tone="info">Total: {total}</Chip>
          <Chip tone="warn">OPEN: {open}</Chip>
          <Chip tone="info">PARTIAL: {partial}</Chip>
          <Chip tone="ok">PAID: {paid}</Chip>
          <Chip tone={cancelled > 0 ? "warn" : "neutral"}>CANCELLED: {cancelled}</Chip>
          <Chip tone={overdue > 0 ? "warn" : "neutral"}>Vencidas: {overdue}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={exportExcel}
            variant="outline"
            className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button
            onClick={exportCSV}
            variant="outline"
            className="bg-white border-sky-200 text-sky-700 hover:bg-sky-50"
          >
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          <Link href="/payments/made">
            <Button variant="outline" className="bg-white">
              <List className="mr-2 h-4 w-4" /> Pagos realizados
            </Button>
          </Link>

          {canCreate && (
            <Link href="/payments/made/new">
              <Button variant="outline" className="bg-white">
                <HandCoins className="mr-2 h-4 w-4" /> Nuevo pago
              </Button>
            </Link>
          )}

          <Link href="/ap-invoices/new">
            <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow">
              <FilePlus className="mr-2 h-4 w-4" /> Nueva Factura
            </Button>
          </Link>
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
          title="Listado de CxP"
          subtitle="Filtrá por estado, buscá por factura/proveedor, y revisá vencimientos."
        />

        <Separator className="my-4" />

        {/* FILTERS */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar (factura, proveedor, estado, id...)"
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

        {/* DATAGRID premium container */}
        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-320px)] w-full">
              <DataGrid
                rows={filteredRows}
                columns={cols}
                getRowId={(r: APInvoiceRow): GridRowId => r.id}
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
