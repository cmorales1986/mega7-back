"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Lock,
  FileSearch,
  ClipboardList,
} from "lucide-react";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// =====================
// UI helpers (mismo estilo que tu ejemplo)
// =====================
function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

type SalesOrder = {
  id: number;
  docNumber: string;
  orderDate: string | null;
  customerId: number;
  customerName: string;
  warehouseId: number;
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED" | "CANCELLED" | string;
  comments?: string | null;
  subTotal?: number;
  taxTotal?: number;
  total: number;
};

export default function SalesOrdersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/salesorders");

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as SalesOrder[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar órdenes de venta", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const action = async (id: number, type: "open" | "close" | "cancel") => {
    const labels: Record<"open" | "close" | "cancel", { title: string; text: string; icon: any }> = {
      open: { title: "Abrir OV", text: "La OV pasará a OPEN.", icon: "question" },
      close: { title: "Cerrar OV", text: "La OV pasará a CLOSED.", icon: "question" },
      cancel: { title: "Cancelar OV", text: "La OV pasará a CANCELED.", icon: "warning" },
    };

    const r = await Swal.fire({
      title: labels[type].title,
      text: labels[type].text,
      icon: labels[type].icon,
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "No",
    });

    if (!r.isConfirmed) return;

    try {
      await api.post(`/salesorders/${id}/${type}`);
      Swal.fire("OK", "Actualizado", "success");
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo ejecutar acción", "error");
    }
  };

  const openPdf = async (id: number, docNumber?: string) => {
    try {
      const res = await api.get(`/salesorders/${id}/pdf`, { responseType: "blob" });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);

      const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `PRESUPUESTO_${docNumber ?? `OV${id}`}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      const msg =
        typeof e?.response?.data === "string" ? e.response.data : e?.message ?? "No se pudo abrir el PDF";
      Swal.fire("Error", msg, "error");
    }
  };

  const canCreate = usePermission("SalesOrders.Create");
  const canEditPerm = usePermission("SalesOrders.Edit");
  const canCancel = usePermission("SalesOrders.Cancel");

  const cols: GridColDef<SalesOrder>[] = [
    { field: "docNumber", headerName: "N°", flex: 0.8, minWidth: 120 },
    {
      field: "orderDate",
      headerName: "Fecha",
      flex: 0.8,
      minWidth: 120,
      valueGetter: (_value, row) => (row?.orderDate ? String(row.orderDate).slice(0, 10) : ""),
    },
    { field: "customerName", headerName: "Cliente", flex: 1.5, minWidth: 220 },
    {
      field: "status",
      headerName: "Estado",
      flex: 0.8,
      minWidth: 120,
      renderCell: (p: GridRenderCellParams<SalesOrder>) => {
        const s = String(p.row.status ?? "").toUpperCase();
        const badge =
          s === "DRAFT"
            ? "bg-slate-100 text-slate-700 border-slate-200"
            : s === "OPEN"
            ? "bg-sky-100 text-sky-700 border-sky-200"
            : s === "CLOSED"
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : "bg-red-100 text-red-700 border-red-200";

        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge}`}>
            {s}
          </span>
        );
      },
    },
    {
      field: "total",
      headerName: "Total",
      flex: 0.8,
      minWidth: 140,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "actions",
      headerName: "Acciones",
      flex: 1.2,
      minWidth: 330,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<SalesOrder>) => {
        const row = p.row;
        const st = String(row.status ?? "").toUpperCase();
        const canEditRow = st === "DRAFT";

        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => openPdf(row.id, row.docNumber)}
              title="Visualizar Presupuesto PDF"
            >
              <FileSearch className="h-4 w-4" />
            </Button>

            {canEditPerm && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                disabled={!canEditRow}
                onClick={() => router.push(`/sales-orders/${row.id}/edit`)}
                title={canEditRow ? "Editar" : "Solo DRAFT"}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              disabled={st !== "DRAFT"}
              onClick={() => action(row.id, "open")}
              title="Abrir"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              disabled={st !== "OPEN"}
              onClick={() => action(row.id, "close")}
              title="Cerrar"
            >
              <Lock className="h-4 w-4" />
            </Button>

            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                disabled={st === "CLOSED" || st === "CANCELED" || st === "CANCELLED"}
                onClick={() => action(row.id, "cancel")}
                title="Cancelar"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // =====================
  // UI computed (chips)
  // =====================
  const counts = useMemo(() => {
    const map = { DRAFT: 0, OPEN: 0, CLOSED: 0, CANCELED: 0 };
    for (const r of rows) {
      const s = String(r.status ?? "").toUpperCase();
      if (s === "DRAFT") map.DRAFT++;
      else if (s === "OPEN") map.OPEN++;
      else if (s === "CLOSED") map.CLOSED++;
      else map.CANCELED++;
    }
    return map;
  }, [rows]);

  const totalSum = useMemo(() => rows.reduce((acc, r) => acc + Number(r.total ?? 0), 0), [rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER premium */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <ClipboardList className="h-5 w-5 text-[#C5A05A]" />
              </div>
              <h1 className="text-3xl font-semibold">Órdenes de Venta</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Listado de OVs (DRAFT / OPEN / CLOSED) con acciones rápidas y exportación de presupuesto PDF.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="neutral">Total: {rows.length}</Chip>
              <Chip tone="warn">Draft: {counts.DRAFT}</Chip>
              <Chip tone="info">Open: {counts.OPEN}</Chip>
              <Chip tone="ok">Closed: {counts.CLOSED}</Chip>
              <Chip tone="neutral">Suma: {fmtPY.format(Math.round(totalSum))}</Chip>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>

            {canCreate && (
              <Button
                onClick={() => router.push("/sales-orders/new")}
                className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
                disabled={loading}
              >
                <Plus className="mr-2 h-4 w-4" /> Nueva OV
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* GRID card */}
      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 560, width: "100%" }}>
            <DataGrid
              rows={rows}
              getRowId={(r: SalesOrder): GridRowId => r.id}
              columns={cols}
              loading={loading}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              disableRowSelectionOnClick
              slots={{ toolbar: GridToolbar }}
              sx={{
                border: 0,
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "#F8FAFC",
                  borderBottom: "1px solid #E2E8F0",
                },
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: 700,
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid #F1F5F9",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#FAFAFA",
                },
                "& .MuiDataGrid-toolbarContainer": {
                  padding: "10px 10px 6px 10px",
                },
              }}
            />
          </div>
        </ThemeProvider>
      </div>
    </div>
  );
}
