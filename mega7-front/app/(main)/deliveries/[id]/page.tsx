"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";

import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, RefreshCcw, ReceiptText, Truck, Ban } from "lucide-react";

import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n || 0));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const idNum = Number(id);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  async function load() {
    if (!idNum || Number.isNaN(idNum)) return;
    setLoading(true);
    try { setDoc(await (await api.get(`/salesdeliveries/${idNum}`)).data); }
    catch (e: any) { Swal.fire("Error", toErrorMsg(e, "No se pudo cargar"), "error"); setDoc(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [idNum]);

  const handleCancel = async () => {
    const { value: reason } = await Swal.fire({
      title: "Anular Entrega",
      text: "Se revertirá el stock de salida. Ingresá el motivo:",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      icon: "warning",
    });
    if (reason === undefined) return;
    try {
      await api.post(`/salesdeliveries/${idNum}/cancel`, { reason: reason || "Anulado manualmente." });
      Swal.fire("Anulada", "La entrega fue anulada y el stock revertido.", "success");
      await load();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo anular"), "error");
    }
  };

  const columns: GridColDef[] = useMemo(() => [
    { field: "productName", headerName: "Producto", flex: 1, minWidth: 260 },
    { field: "quantity", headerName: "Cant.", width: 110, align: "center", headerAlign: "center", valueFormatter: (p: any) => money(p?.value ?? p) },
    { field: "unitPrice", headerName: "Precio", width: 130, align: "right", headerAlign: "right", valueFormatter: (p: any) => money(p?.value ?? p) },
    { field: "lineTotal", headerName: "Total", width: 130, align: "right", headerAlign: "right", valueFormatter: (p: any) => money(p?.value ?? p) },
    {
      field: "lotSerial", headerName: "Lote/Serie", width: 220,
      renderCell: (params) => {
        const batch  = (params.row?.batchNumber ?? "").trim();
        const serial = (params.row?.serialNumbers ?? "").trim();
        if (batch) return <span className="text-xs"><b>Lote:</b> {batch}</span>;
        if (serial) {
          const cnt = serial.split(/,|\n|\r|;/).map((x: any) => String(x).trim()).filter(Boolean).length;
          return <span className="text-xs"><b>Series:</b> {cnt}</span>;
        }
        return <span className="text-xs text-gray-400">—</span>;
      },
    },
  ], []);

  const isCancelled = doc?.isCancelled || String(doc?.status ?? "").toUpperCase() === "CANCELLED";
  const isDirecta   = !doc?.salesOrderId;

  return (
    <PageShell
      icon={<Truck className="h-6 w-6 text-orange-500" />}
      title={`Entrega ${doc?.docNumber ?? `#${idNum}`}`}
      subtitle={isDirecta ? "Entrega directa (sin OV)" : `OV #${doc?.salesOrderId}`}
      chips={
        <>
          {isCancelled && <Chip tone="warn">ANULADA</Chip>}
          {doc?.isInvoiced && <Chip tone="info">Facturada</Chip>}
          {isDirecta && <Chip tone="neutral">Directa</Chip>}
        </>
      }
      right={
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => router.push("/deliveries")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          {!isCancelled && !doc?.isInvoiced && (
            <Link href={`/sales-invoices/new?deliveryId=${idNum}`}>
              <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
                <ReceiptText className="mr-2 h-4 w-4" /> Facturar
              </Button>
            </Link>
          )}
          {!isCancelled && (
            <Button
              variant="outline"
              className="bg-white border-red-200 text-red-700 hover:bg-red-50"
              onClick={handleCancel}
              disabled={loading}
            >
              <Ban className="mr-2 h-4 w-4" /> Anular
            </Button>
          )}
          <Button variant="outline" className="bg-white" onClick={load}><RefreshCcw className="mr-2 h-4 w-4" /> Refrescar</Button>
        </div>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        {!doc ? (
          <div className="text-gray-600">{loading ? "Cargando..." : "Sin datos"}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-gray-500">Fecha</div><div className="font-semibold">{fmtDate(doc.deliveryDate)}</div></div>
              <div><div className="text-xs text-gray-500">Cliente</div><div className="font-semibold">{doc.customerName}</div></div>
              <div><div className="text-xs text-gray-500">Depósito</div><div className="font-semibold">{doc?.warehouse?.name ?? "—"}</div></div>
              <div className="md:text-right"><div className="text-xs text-gray-500">Total</div><div className="text-xl font-bold">{money(doc.total)}</div></div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-xs text-gray-500">Observaciones</div><div className="font-medium">{doc.comments || "—"}</div></div>
              {doc.salesOrderId && (
                <div><div className="text-xs text-gray-500">Orden de Venta</div><div className="font-medium">OV #{doc.salesOrderId}</div></div>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="border-slate-200 p-4 shadow-sm">
        <ThemeProvider theme={muiTheme}>
          <div className="h-[480px]">
            <DataGrid rows={doc?.lines ?? []} columns={columns} loading={loading} getRowId={(r) => (r as any).id} pageSizeOptions={[10, 20, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} disableRowSelectionOnClick />
          </div>
        </ThemeProvider>
      </Card>
    </PageShell>
  );
}
