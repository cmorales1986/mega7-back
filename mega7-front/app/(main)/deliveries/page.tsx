"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { usePermission } from "@/hooks/use-permission";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, RefreshCcw, Eye, Truck, Ban } from "lucide-react";

import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n || 0));
const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

type DeliveryRow = {
  id: number;
  docNumber: string;
  deliveryDate: string;
  customerName: string;
  warehouseId: number;
  salesOrderId?: number | null;
  total: number;
  status: string;
  isCancelled?: boolean;
  isInvoiced: boolean;
};

const StatusBadge = ({ row }: { row: DeliveryRow }) => {
  const cancelled = row.isCancelled || String(row.status ?? "").toUpperCase() === "CANCELLED";
  return (
    <span className={`px-3 py-1 rounded-md text-white text-xs font-medium ${cancelled ? "bg-gray-500" : "bg-green-600"}`}>
      {cancelled ? "ANULADA" : "POSTEADA"}
    </span>
  );
};

const InvoicedBadge = ({ invoiced }: { invoiced: boolean }) => (
  <span className={`px-3 py-1 rounded-md text-white text-xs font-medium ${invoiced ? "bg-blue-600" : "bg-amber-500"}`}>
    {invoiced ? "SÍ" : "NO"}
  </span>
);

export default function DeliveriesListPage() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [invoicedFilter, setInvoicedFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [showCancelled, setShowCancelled] = useState(false);

  const canCreate = usePermission("SalesDeliveries.Create");
  const canCancel = usePermission("SalesDeliveries.Cancel");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/salesdeliveries", { params: { includeCancelled: true } });
      setRows(res.data ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar"), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(row: DeliveryRow) {
    const { value, isConfirmed } = await Swal.fire({
      title: "Anular Entrega",
      text: `¿Anular ${row.docNumber}? Esto revertirá el stock de salida.`,
      input: "text",
      inputLabel: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!isConfirmed) return;
    try {
      await api.post(`/salesdeliveries/${row.id}/cancel`, { reason: value || null });
      Swal.fire("OK", "Entrega anulada y stock revertido.", "success");
      load();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo anular"), "error");
    }
  }

  const filteredRows = useMemo(() => {
    let list = rows;
    if (!showCancelled) list = list.filter((r) => !r.isCancelled && String(r.status ?? "").toUpperCase() !== "CANCELLED");
    if (invoicedFilter === "YES") list = list.filter((r) => r.isInvoiced);
    if (invoicedFilter === "NO") list = list.filter((r) => !r.isInvoiced);
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter((r) =>
      String(r.docNumber ?? "").toLowerCase().includes(q) ||
      String(r.customerName ?? "").toLowerCase().includes(q)
    );
  }, [rows, search, invoicedFilter, showCancelled]);

  const total     = rows.length;
  const posteadas = rows.filter((r) => !r.isCancelled && String(r.status ?? "").toUpperCase() !== "CANCELLED").length;
  const facturadas = rows.filter((r) => r.isInvoiced).length;
  const sinFact   = rows.filter((r) => !r.isInvoiced && !r.isCancelled && String(r.status ?? "").toUpperCase() !== "CANCELLED").length;
  const anuladas  = rows.filter((r) => r.isCancelled || String(r.status ?? "").toUpperCase() === "CANCELLED").length;
  const directas  = rows.filter((r) => !r.salesOrderId).length;

  const cols: GridColDef<DeliveryRow>[] = [
    { field: "docNumber", headerName: "N°", width: 140 },
    { field: "deliveryDate", headerName: "Fecha", width: 120, valueGetter: (_v, row) => row.deliveryDate ? String(row.deliveryDate).slice(0, 10) : "" },
    { field: "customerName", headerName: "Cliente", flex: 1, minWidth: 220 },
    {
      field: "salesOrderId", headerName: "OV", width: 110, headerAlign: "center", align: "center",
      renderCell: (p) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.row.salesOrderId ? "bg-slate-100 text-slate-700" : "bg-purple-100 text-purple-700"}`}>
          {p.row.salesOrderId ? `OV#${p.row.salesOrderId}` : "DIRECTA"}
        </span>
      ),
    },
    { field: "total", headerName: "Total", width: 140, headerAlign: "right", align: "right", valueFormatter: (value) => money(value) },
    { field: "status", headerName: "Estado", width: 120, headerAlign: "center", align: "center", renderCell: (p) => <StatusBadge row={p.row} /> },
    { field: "isInvoiced", headerName: "Facturada", width: 110, headerAlign: "center", align: "center", renderCell: (p) => <InvoicedBadge invoiced={!!p.row.isInvoiced} /> },
    {
      field: "actions", headerName: "Acciones", width: 110, sortable: false, filterable: false, disableColumnMenu: true, headerAlign: "center", align: "center",
      renderCell: (p: GridRenderCellParams<DeliveryRow>) => {
        const cancelled = p.row.isCancelled || String(p.row.status ?? "").toUpperCase() === "CANCELLED";
        return (
          <div className="flex items-center justify-center gap-1 h-full">
            <Link href={`/deliveries/${p.row.id}`}>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-white" title="Ver"><Eye className="h-4 w-4" /></Button>
            </Link>
            {canCancel && !cancelled && !p.row.isInvoiced && (
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-white text-red-500 hover:text-red-700 hover:border-red-300" title="Anular" onClick={() => handleCancel(p.row)}>
                <Ban className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      icon={<Truck className="h-6 w-6 text-orange-500" />}
      title="Entregas de Venta"
      subtitle="Historial de entregas de inventario a clientes, con y sin Orden de Venta."
      chips={
        <>
          <Chip tone="neutral">Total: {total}</Chip>
          <Chip tone="ok">Posteadas: {posteadas}</Chip>
          <Chip tone="info">Facturadas: {facturadas}</Chip>
          <Chip tone="warn">Sin factura: {sinFact}</Chip>
          <Chip tone="neutral">Directas: {directas}</Chip>
          {anuladas > 0 && <Chip tone="warn">Anuladas: {anuladas}</Chip>}
        </>
      }
      right={
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={load} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" /> Refrescar</Button>
          {canCreate && (
            <Link href="/deliveries/new">
              <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"><Plus className="mr-2 h-4 w-4" /> Nueva Entrega</Button>
            </Link>
          )}
        </div>
      }
    >
      <Card className="border-slate-200 p-4 shadow-sm">
        <SectionHeader icon={<Truck className="h-5 w-5 text-orange-500" />} title="Entregas" subtitle="Buscá por número o cliente. Filtrá por estado de facturación." />
        <Separator className="my-4" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input placeholder="Buscar (Nro., cliente...)" className="max-w-xl bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Facturada</label>
              <select className="h-9 rounded-md border px-3 bg-white text-sm" value={invoicedFilter} onChange={(e) => setInvoicedFilter(e.target.value as any)}>
                <option value="ALL">Todas</option>
                <option value="YES">Solo facturadas</option>
                <option value="NO">Sin factura</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input id="showCancelled" type="checkbox" className="h-4 w-4" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              <label htmlFor="showCancelled" className="text-sm text-gray-700 select-none">Ver anuladas</label>
            </div>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-320px)] w-full">
              <DataGrid rows={filteredRows} columns={cols} getRowId={(r: DeliveryRow): GridRowId => r.id} loading={loading} pageSizeOptions={[10, 20, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} disableRowSelectionOnClick slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }} />
            </div>
          </ThemeProvider>
        </div>
      </Card>
    </PageShell>
  );
}
