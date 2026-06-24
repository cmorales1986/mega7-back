"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Link from "next/link";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, RefreshCcw, Pencil, ReceiptText } from "lucide-react";

import { getPurchaseReceiptById } from "@/features/purchasing/purchase-receipts/api";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n || 0));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

export default function PurchaseReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const idNum = Number(id);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  async function load() {
    if (!idNum || Number.isNaN(idNum)) return;
    setLoading(true);
    try {
      const data = await getPurchaseReceiptById(idNum);
      setDoc(data);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar", "error");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [idNum]);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "productName", headerName: "Producto", flex: 1, minWidth: 260 },
      {
        field: "quantity",
        headerName: "Cant.",
        width: 120,
        align: "center",
        headerAlign: "center",
        valueFormatter: (p: any) => money(p?.value),
      },
      {
        field: "unitPrice",
        headerName: "Precio",
        width: 140,
        align: "right",
        headerAlign: "right",
        valueFormatter: (p: any) => money(p?.value),
      },
      {
        field: "lineTotal",
        headerName: "Total",
        width: 140,
        align: "right",
        headerAlign: "right",
        valueFormatter: (p: any) => money(p?.value),
      },
      {
        field: "lotSerial",
        headerName: "Lote/Serie",
        width: 260,
        renderCell: (params) => {
          const r = params.row;
          const batch = (r?.batchNumber ?? "").trim();
          const serial = (r?.serialNumbers ?? "").trim();
          if (batch) return <span className="text-xs"><b>Lote:</b> {batch}</span>;
          if (serial) {
            const count = serial.split(/,|\n|\r|;/).map((x: any) => String(x).trim()).filter(Boolean).length;
            return <span className="text-xs"><b>Series:</b> {count}</span>;
          }
          return <span className="text-xs text-gray-500">—</span>;
        },
      },
    ],
    []
  );

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#C5A05A]" />}
      title={`Recepción #${doc?.docNumber ?? idNum}`}
      subtitle="Detalle de la recepción."
      right={
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => router.push("/purchase-receipts")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Link href={`/purchase-receipts/${idNum}/edit`}>
            <Button variant="outline" className="bg-white">
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </Link>

          <Button variant="outline" className="bg-white" onClick={load}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
        </div>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        {!doc ? (
          <div className="text-gray-600">{loading ? "Cargando..." : "Sin datos"}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="font-semibold">{fmtDate(doc.receiptDate)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Proveedor</div>
                <div className="font-semibold">{doc.supplierName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Depósito</div>
                <div className="font-semibold">{doc?.warehouse?.name ?? ""}</div>
              </div>
              <div className="md:text-right">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-xl font-bold">{money(doc.total)}</div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Comentarios</div>
                <div className="font-medium">{doc.comments || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Documentos</div>
                <div className="font-medium">
                  {(doc.documents ?? []).length ? (
                    (doc.documents ?? []).map((d: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <b>{d.type}</b>: {d.number}
                      </div>
                    ))
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="border-slate-200 p-4 shadow-sm">
        <ThemeProvider theme={muiTheme}>
          <div className="h-[520px]">
            <DataGrid
              rows={doc?.lines ?? []}
              columns={columns}
              loading={loading}
              getRowId={(r) => (r as any).id}
              pageSizeOptions={[10, 20, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              disableRowSelectionOnClick
            />
          </div>
        </ThemeProvider>
      </Card>
    </PageShell>
  );
}
