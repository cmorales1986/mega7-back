"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import {
  Plus,
  RefreshCcw,
  Ban,
  Eye,
  ReceiptText,
  FilterX,
  Printer,
} from "lucide-react";

// ✅ tus componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type Row = {
  id: number;
  docNumber: string;
  fiscalNumber?: string | null;
  fiscalFullNumber?: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  customerId: number;
  customerName: string;
  warehouse?: { id: number; name: string } | null;
  paymentType?: string | null;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  isOverdue?: boolean;
};

export default function SalesInvoicesInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // --------- query params ----------
  const filter = (sp.get("filter") ?? "").trim().toLowerCase();
  const overdueParam = (sp.get("overdue") ?? "").trim().toLowerCase();
  const includeCancelledParam = (sp.get("includeCancelled") ?? "").trim().toLowerCase();

  const overdue =
    overdueParam === "true" ||
    overdueParam === "1" ||
    filter === "overdue";

  const includeCancelled =
    includeCancelledParam === "true" || includeCancelledParam === "1";

  const hasFilter = Boolean(filter) || Boolean(overdueParam) || includeCancelled;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};

      if (includeCancelled) params.includeCancelled = true;

      if (filter) params.filter = filter;
      else if (overdue) params.overdue = true;

      const res = await api.get("/salesinvoices", { params });

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as Row[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar facturas", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, overdue, includeCancelled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearFilters = () => {
    router.push("/sales-invoices");
    router.refresh();
  };

  const badge = (s: string, overdueFlag?: boolean) => {
    const st = (s ?? "").toUpperCase();
    const cls =
      st === "OPEN"
        ? overdueFlag
          ? "bg-amber-100 text-amber-800"
          : "bg-blue-100 text-blue-700"
        : st === "PARTIAL"
        ? "bg-purple-100 text-purple-700"
        : st === "PAID"
        ? "bg-green-100 text-green-700"
        : st === "CANCELLED"
        ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-700";

    return (
      <span className={`px-2 py-1 rounded text-[11px] font-semibold ${cls}`}>
        {st}
      </span>
    );
  };

  const openPdf = async (id: number, docNumber?: string) => {
    try {
      const res = await api.get(`/reports/sales-invoice/${id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo abrir PDF", "error");
    }
  };

  const cancel = async (id: number) => {
    const r = await Swal.fire({
      title: "Cancelar Factura",
      text: "Quedará CANCELLED (auditoría). No se permite si tiene cobros.",
      icon: "warning",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "No",
    });

    if (!r.isConfirmed) return;

    try {
      await api.post(`/salesinvoices/${id}/cancel`, { reason: r.value ?? null });
      Swal.fire("OK", "Factura cancelada", "success");
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cancelar", "error");
    }
  };

  const summary = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
    const balance = rows.reduce((a, r) => a + Number(r.balance ?? 0), 0);
    const open = rows.filter((r) => String(r.status ?? "").toUpperCase() === "OPEN").length;
    const partial = rows.filter((r) => String(r.status ?? "").toUpperCase() === "PARTIAL").length;
    const paid = rows.filter((r) => String(r.status ?? "").toUpperCase() === "PAID").length;
    const cancelled = rows.filter((r) => String(r.status ?? "").toUpperCase() === "CANCELLED").length;
    const overdueRows = rows.filter((r) => Boolean(r.isOverdue)).length;
    return { total, balance, open, partial, paid, cancelled, overdueRows, count: rows.length };
  }, [rows]);

  const filterLabel = useMemo(() => {
    if (filter === "overdue" || overdue) return "Filtro: Vencidas";
    if (filter === "today-unpaid") return "Filtro: Hoy sin cobrar";
    if (includeCancelled && !filter && !overdueParam) return "Incluye canceladas";
    return "";
  }, [filter, overdue, overdueParam, includeCancelled]);

  const cols: GridColDef<Row>[] = [
    { field: "docNumber", headerName: "N°", flex: 0.6, minWidth: 80 },
    {
      field: "fiscalFullNumber",
      headerName: "N° fiscal",
      flex: 0.9,
      minWidth: 120,
      valueGetter: (_v, row) => row?.fiscalFullNumber ?? "",
    },
    {
      field: "invoiceDate",
      headerName: "Fecha",
      flex: 0.7,
      minWidth: 100,
      valueGetter: (_v, row) => (row?.invoiceDate ? String(row.invoiceDate).slice(0, 10) : ""),
    },
    {
      field: "dueDate",
      headerName: "Venc.",
      flex: 0.7,
      minWidth: 100,
      valueGetter: (_v, row) => (row?.dueDate ? String(row.dueDate).slice(0, 10) : ""),
    },
    { field: "customerName", headerName: "Cliente", flex: 1.4, minWidth: 200 },
    {
      field: "paymentType",
      headerName: "Pago",
      flex: 0.6,
      minWidth: 80,
      valueGetter: (_v, row) => (row?.paymentType ? String(row.paymentType).toUpperCase() : ""),
    },
    {
      field: "status",
      headerName: "Estado",
      flex: 0.7,
      minWidth: 90,
      renderCell: (p: GridRenderCellParams<Row>) => badge(p.row.status, Boolean(p.row.isOverdue)),
    },
    {
      field: "total",
      headerName: "Total",
      flex: 0.7,
      minWidth: 100,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "balance",
      headerName: "Saldo",
      flex: 0.7,
      minWidth: 100,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "actions",
      headerName: "Acciones",
      flex: 1.0,
      minWidth: 180,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<Row>) => {
        const row = p.row;
        const st = (row.status ?? "").toUpperCase();
        const canCancel = st !== "CANCELLED" && st !== "PAID";

        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => router.push(`/sales-invoices/${row.id}`)}
              title="Ver detalle"
            >
              <Eye className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => openPdf(row.id, row.docNumber)}
              title="Visualizar Factura"
            >
              <Printer className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canCancel}
              onClick={() => cancel(row.id)}
              title={canCancel ? "Cancelar" : "No se puede (PAID/CANCELLED)"}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#C5A05A]" />}
      title="Facturas de Venta (CxC)"
      subtitle="Listado, PDF, detalle y cancelación (con auditoría)."
      chips={
        <>
          {filterLabel ? <Chip tone="info">{filterLabel}</Chip> : null}
          <Chip tone="neutral">Docs: {summary.count}</Chip>
          <Chip tone="info">OPEN: {summary.open}</Chip>
          <Chip tone="neutral">PARTIAL: {summary.partial}</Chip>
          <Chip tone="ok">PAID: {summary.paid}</Chip>
          {includeCancelled ? <Chip tone="warn">CANCELLED: {summary.cancelled}</Chip> : null}
          <Chip tone="warn">Saldo: {fmtPY.format(summary.balance)}</Chip>
          {summary.overdueRows > 0 ? <Chip tone="warn">Vencidas: {summary.overdueRows}</Chip> : null}
        </>
      }
      right={
        <>
          {hasFilter ? (
            <Button onClick={() => { router.push("/sales-invoices"); router.refresh(); }} variant="outline" disabled={loading}>
              <FilterX className="mr-2 h-4 w-4" /> Limpiar filtro
            </Button>
          ) : null}

          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={() => router.push("/sales-invoices/new")}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            disabled={loading}
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva FV
          </Button>
        </>
      }
    >
      <div className="bg-white rounded-xl shadow border p-3">
        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 520, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={cols}
              getRowId={(r) => r.id}
              loading={loading}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
              }}
              disableRowSelectionOnClick
              density="compact"
              rowHeight={50}
              columnHeaderHeight={50}
              slots={{ toolbar: GridToolbar }}
              slotProps={{ toolbar: { showQuickFilter: true } }}
              sx={{
                "& .MuiDataGrid-cell": { fontSize: 12, py: 0.5 },
                "& .MuiDataGrid-columnHeaderTitle": { fontSize: 14, fontWeight: 700 },
                "& .MuiDataGrid-toolbarContainer": { p: "12px 8px" },
                "& .MuiDataGrid-footerContainer": { minHeight: 44 },
              }}
            />
          </div>
        </ThemeProvider>
      </div>
    </PageShell>
  );
}
