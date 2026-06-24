"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

// ✅ tus componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI DataGrid
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type PurchaseOrder = {
  id: number;
  docNumber: string;
  orderDate: string | null;
  supplierId: number;
  supplierName: string;
  warehouseId: number;
  status: "DRAFT" | "OPEN" | "CLOSED" | "CANCELED";
  comments?: string | null;
  subTotal: number;
  taxTotal: number;
  total: number;
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/purchaseorders");

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as PurchaseOrder[]) ?? []);
    } catch (e: any) {
      Swal.fire(
        "Error",
        toErrorMsg(e, "No se pudo cargar órdenes"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const action = async (id: number, type: "open" | "close" | "cancel") => {
    const labels: Record<
      "open" | "close" | "cancel",
      { title: string; text: string; icon: any }
    > = {
      open: { title: "Abrir OC", text: "La OC pasará a OPEN.", icon: "question" },
      close: {
        title: "Cerrar OC",
        text: "La OC pasará a CLOSED.",
        icon: "question",
      },
      cancel: {
        title: "Cancelar OC",
        text: "La OC pasará a CANCELED.",
        icon: "warning",
      },
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
      await api.post(`/purchaseorders/${id}/${type}`);
      Swal.fire("OK", "Actualizado", "success");
      await loadData();
    } catch (e: any) {
      Swal.fire(
        "Error",
        toErrorMsg(e, "No se pudo ejecutar acción"),
        "error"
      );
    }
  };

  const openPdf = async (id: number, docNumber?: string) => {
    try {
      const res = await api.get(`/purchaseorders/${id}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);

      const w = window.open(blobUrl, "_blank", "noopener,noreferrer");

      if (!w) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${docNumber ?? `OC${id}`}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      Swal.fire(
        "Error",
        e?.response?.status === 401
          ? "No autorizado. Iniciá sesión de nuevo."
          : toErrorMsg(e, "No se pudo abrir el PDF"),
        "error"
      );
    }
  };

  const counts = useMemo(() => {
    const c = { DRAFT: 0, OPEN: 0, CLOSED: 0, CANCELED: 0 };
    for (const r of rows) {
      if (r?.status && c[r.status] !== undefined) c[r.status]++;
    }
    return c;
  }, [rows]);

  const canCreate = usePermission("PurchaseOrders.Create");
  const canEditPerm = usePermission("PurchaseOrders.Edit");
  const canCancel = usePermission("PurchaseOrders.Cancel");

  const cols: GridColDef<PurchaseOrder>[] = [
    { field: "docNumber", headerName: "N°", flex: 0.8, minWidth: 120 },
    {
      field: "orderDate",
      headerName: "Fecha",
      flex: 0.8,
      minWidth: 120,
      valueGetter: (_value, row) =>
        row?.orderDate ? String(row.orderDate).slice(0, 10) : "",
    },
    {
      field: "supplierName",
      headerName: "Proveedor",
      flex: 1.5,
      minWidth: 220,
    },
    {
      field: "status",
      headerName: "Estado",
      flex: 0.8,
      minWidth: 120,
      renderCell: (p: GridRenderCellParams<PurchaseOrder>) => {
        const s = p.row.status;

        const badge =
          s === "DRAFT"
            ? "bg-slate-50 text-slate-700 border-slate-200"
            : s === "OPEN"
            ? "bg-sky-50 text-sky-700 border-sky-200"
            : s === "CLOSED"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-rose-50 text-rose-700 border-rose-200";

        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold border ${badge}`}
          >
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
      renderCell: (p: GridRenderCellParams<PurchaseOrder>) => {
        const row = p.row;
        const canEditRow = row.status === "DRAFT";

        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => openPdf(row.id, row.docNumber)}
              title="Visualizar OC PDF"
            >
              <FileSearch className="h-4 w-4" />
            </Button>

            {canEditPerm && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                disabled={!canEditRow}
                onClick={() => router.push(`/purchase-orders/${row.id}/edit`)}
                title={canEditRow ? "Editar" : "Solo DRAFT"}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              disabled={row.status !== "DRAFT"}
              onClick={() => action(row.id, "open")}
              title="Abrir"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              disabled={row.status !== "OPEN"}
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
                disabled={row.status === "CLOSED"}
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

  return (
    <PageShell
      icon={<ClipboardList className="h-6 w-6 text-[#C5A05A]" />}
      title="Órdenes de Compra"
      subtitle="Gestioná OCs: crear, editar borradores, abrir/cerrar/cancelar y ver el PDF."
      chips={
        <>
          <Chip tone="neutral">Total: {rows.length}</Chip>
          <Chip tone="neutral">DRAFT: {counts.DRAFT}</Chip>
          <Chip tone="info">OPEN: {counts.OPEN}</Chip>
          <Chip tone="ok">CLOSED: {counts.CLOSED}</Chip>
          <Chip tone="warn">CANCELED: {counts.CANCELED}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          {canCreate && (
            <Button
              onClick={() => router.push("/purchase-orders/new")}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva OC
            </Button>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<FileSearch className="h-5 w-5 text-[#C5A05A]" />}
          title="Listado"
          subtitle="Acciones disponibles según el estado: editar solo DRAFT, cerrar solo OPEN."
        />

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
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
              />
            </div>
          </ThemeProvider>
        </div>
      </Card>
    </PageShell>
  );
}
