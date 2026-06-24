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

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { RefreshCcw, Eye, Plus, Printer, Inbox } from "lucide-react";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

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

export default function PaymentsReceivedPage() {
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);

  const openReceiptPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/sales-receipt/${id}/pdf`, { responseType: "blob" });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/arsalesreceipts`, {
        params: pendingOnly ? { pendingDeposit: true } : {},
      });

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as ReceiptRow[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar Recibos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOnly]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.customerName ?? "").toLowerCase().includes(q) ||
        String(r.fiscalFullNumber ?? "").toLowerCase().includes(q) ||
        String(r.paymentMethod ?? "").toLowerCase().includes(q) ||
        String(r.id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const canCreate = usePermission("ARPayments.Create");

  const cols: GridColDef<ReceiptRow>[] = [
    { field: "id", headerName: "ID", width: 90 },
    {
      field: "fiscalFullNumber",
      headerName: "N° Recibo",
      width: 170,
      valueGetter: (_v, row) => row.fiscalFullNumber ?? "",
    },
    {
      field: "receiptDate",
      headerName: "Fecha",
      width: 120,
      valueGetter: (_v, row) => (row.receiptDate ? String(row.receiptDate).slice(0, 10) : ""),
    },
    { field: "customerName", headerName: "Cliente", flex: 1, minWidth: 240 },
    { field: "paymentMethod", headerName: "Método", width: 120 },
    {
      field: "totalReceived",
      headerName: "Total",
      width: 140,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "isDeposited",
      headerName: "Depósito",
      width: 140,
      valueGetter: (_v, row) => (row.isDeposited ? "DEPOSITADO" : "PENDIENTE"),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 160,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<ReceiptRow>) => {
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Link href={`/payments/received/${p.row.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                title="Ver"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              title="Imprimir recibo"
              onClick={() => openReceiptPdfById(p.row.id)}
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // ========= CHIPS =========
  const totalCount = rows.length;
  const pendingCount = rows.filter((r) => !r.isDeposited).length;
  const depositedCount = rows.filter((r) => r.isDeposited).length;

  return (
    <PageShell
      icon={<Inbox className="h-5 w-5 text-purple-600" />}
      title="Pagos · Recibidos"
      subtitle="Cobros a clientes, recibos emitidos y estado de depósito."
      chips={
        <>
          <Chip tone="info">Total: {totalCount}</Chip>
          <Chip tone={pendingCount > 0 ? "warn" : "neutral"}>Pendientes: {pendingCount}</Chip>
          <Chip tone="ok">Depositados: {depositedCount}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          {canCreate && (
            <Link href="/payments/received/new">
              <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
                <Plus className="mr-2 h-4 w-4" /> Nuevo cobro
              </Button>
            </Link>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Inbox className="h-5 w-5 text-purple-600" />}
          title="Listado de Recibos"
          subtitle="Buscá por cliente / número fiscal / método. Podés filtrar pendientes de depósito."
        />

        <Separator className="my-4" />

        {/* FILTERS */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar (cliente, nro fiscal, método, id...)"
            className="max-w-xl bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex items-center gap-2">
            <input
              id="pendingOnly"
              type="checkbox"
              className="h-4 w-4"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />
            <label htmlFor="pendingOnly" className="text-sm text-gray-700 select-none">
              Solo pendientes de depósito
            </label>
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
                getRowId={(r: ReceiptRow): GridRowId => r.id}
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
          Tip: “Pendiente” significa que aún no se depositó en un banco (lo haremos luego en Recaudaciones a Depositar).
        </div>
      </Card>
    </PageShell>
  );
}
