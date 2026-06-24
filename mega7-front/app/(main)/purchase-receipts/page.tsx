"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import Link from "next/link";
import Swal from "sweetalert2";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, RefreshCcw, Eye, ReceiptText, Pencil } from "lucide-react";

import { listPurchaseReceipts } from "@/features/purchasing/purchase-receipts/api";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n || 0));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

export default function PurchaseReceiptsListPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const data = await listPurchaseReceipts();
      setRows(data ?? []);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const canCreate = usePermission("PurchaseReceipts.Create");
  const canEdit = usePermission("PurchaseReceipts.Edit");

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "docNumber", headerName: "N°", width: 140 },
      {
        field: "receiptDate",
        headerName: "Fecha",
        width: 130,
        valueFormatter: (p: any) => fmtDate(p?.value),
      },
      { field: "supplierName", headerName: "Proveedor", flex: 1, minWidth: 220 },
      {
        field: "total",
        headerName: "Total",
        width: 140,
        headerAlign: "right",
        align: "right",
        valueFormatter: (p: any) => money(p?.value),
      },
      {
        field: "status",
        headerName: "Estado",
        width: 130,
      },
      {
        field: "isInvoiced",
        headerName: "Facturada",
        width: 110,
        valueFormatter: (p: any) => (p?.value ? "SI" : "NO"),
      },
      {
        field: "actions",
        headerName: "",
        width: 160,
        sortable: false,
        renderCell: (params) => {
          const id = params.row?.id;
          return (
            <div className="flex gap-2">
              <Link href={`/purchase-receipts/${id}`}>
                <Button size="sm" variant="outline" className="bg-white">
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
              {canEdit && (
                <Link href={`/purchase-receipts/${id}/edit`}>
                  <Button size="sm" variant="outline" className="bg-white">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          );
        },
      },
    ],
    [canEdit]
  );

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#C5A05A]" />}
      title="Recepciones de Compra"
      subtitle="Listado de recepciones (sin PDF; luego BoldReports)."
      right={
        <div className="flex gap-2">
          {canCreate && (
            <Link href="/purchase-receipts/new">
              <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white">
                <Plus className="mr-2 h-4 w-4" /> Nueva
              </Button>
            </Link>
          )}
          <Button variant="outline" className="bg-white" onClick={load}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
        </div>
      }
    >
      <Card className="border-slate-200 p-4 shadow-sm">
        <ThemeProvider theme={muiTheme}>
          <div className="h-[620px]">
            <DataGrid
              rows={rows}
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
