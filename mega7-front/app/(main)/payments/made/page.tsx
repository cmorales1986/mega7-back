"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

import { RefreshCcw, Eye, Plus, Printer, HandCoins, Ban } from "lucide-react";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n ?? 0));

type PaymentMadeRow = {
  id: number;
  paymentDate: string;
  supplierId?: number | null;
  payeeName: string;
  paymentType: string;
  method: string;
  reference?: string | null;
  totalAmount: number;
  status: string; // POSTED | CANCELLED
  createdAt?: string | null;
  cancelledAt?: string | null;
  hasApplies: boolean; // viene del endpoint
};

const norm = (s?: string | null) => String(s ?? "").toUpperCase().trim();

export default function PaymentsMadePage() {
  const [rows, setRows] = useState<PaymentMadeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const openPdfById = async (id: number) => {
    const pdfRes = await api.get(`/reports/payment-made/${id}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/paymentsmade`, {
        params: { includeCancelled: true }, // traemos todo, filtramos en front
      });

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      setRows((data.filter(Boolean) as PaymentMadeRow[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar Pagos Realizados", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = useMemo(() => {
    const base = includeCancelled ? rows : rows.filter((r) => norm(r.status) !== "CANCELLED");

    const q = search.toLowerCase().trim();
    if (!q) return base;

    return base.filter((r) => {
      return (
        String(r.payeeName ?? "").toLowerCase().includes(q) ||
        String(r.paymentType ?? "").toLowerCase().includes(q) ||
        String(r.method ?? "").toLowerCase().includes(q) ||
        String(r.reference ?? "").toLowerCase().includes(q) ||
        String(r.id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, includeCancelled, search]);

  const cancelDoc = async (id: number) => {
    const ask = await Swal.fire({
      title: "Anular pago",
      input: "text",
      inputLabel: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
    });

    if (!ask.isConfirmed) return;

    try {
      setLoading(true);
      await api.post(`/paymentsmade/${id}/cancel`, { reason: ask.value || null });
      Swal.fire("OK", "Pago anulado.", "success");
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo anular", "error");
    } finally {
      setLoading(false);
    }
  };

  const cols: GridColDef<PaymentMadeRow>[] = [
    { field: "id", headerName: "ID", width: 90 },

    {
      field: "paymentDate",
      headerName: "Fecha",
      width: 120,
      valueGetter: (_v, row) => (row.paymentDate ? String(row.paymentDate).slice(0, 10) : ""),
    },

    { field: "payeeName", headerName: "Beneficiario", flex: 1, minWidth: 240 },
    { field: "paymentType", headerName: "Tipo", width: 120 },
    { field: "method", headerName: "Método", width: 120 },

    {
      field: "totalAmount",
      headerName: "Total",
      width: 140,
      valueFormatter: (value) => money(value),
    },

    {
      field: "status",
      headerName: "Estado",
      width: 140,
      valueGetter: (_v, row) => (norm(row.status) === "CANCELLED" ? "ANULADO" : "POSTED"),
    },

    {
      field: "hasApplies",
      headerName: "Con factura",
      width: 140,
      valueGetter: (_v, row) => (row.hasApplies ? "SÍ" : "NO"),
    },

    {
      field: "actions",
      headerName: "Acciones",
      width: 200,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<PaymentMadeRow>) => {
        const isCancelled = norm(p.row.status) === "CANCELLED";

        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Link href={`/payments/made/${p.row.id}`}>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white" title="Ver">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              title="Imprimir"
              onClick={() => openPdfById(p.row.id)}
            >
              <Printer className="h-4 w-4" />
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-9 w-9 p-0"
              title="Anular"
              disabled={isCancelled}
              onClick={() => cancelDoc(p.row.id)}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // ========= CHIPS =========
  const totalCount = rows.length;
  const postedCount = rows.filter((r) => norm(r.status) !== "CANCELLED").length;
  const cancelledCount = rows.filter((r) => norm(r.status) === "CANCELLED").length;

  const withInvCount = rows.filter((r) => r.hasApplies && norm(r.status) !== "CANCELLED").length;
  const withoutInvCount = rows.filter((r) => !r.hasApplies && norm(r.status) !== "CANCELLED").length;

  const sumPosted = rows
    .filter((r) => norm(r.status) !== "CANCELLED")
    .reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);

  return (
    <PageShell
      icon={<HandCoins className="h-5 w-5 text-purple-600" />}
      title="Pagos · Realizados"
      subtitle="Pagos a proveedores / sueldos / IPS / impuestos (con o sin facturas)."
      chips={
        <>
          <Chip tone="info">Total: {totalCount}</Chip>
          <Chip tone="ok">Posted: {postedCount}</Chip>
          <Chip tone={cancelledCount > 0 ? "warn" : "neutral"}>Anulados: {cancelledCount}</Chip>
          <Chip tone="info">Con factura: {withInvCount}</Chip>
          <Chip tone="neutral">Sin factura: {withoutInvCount}</Chip>
          <Chip tone="ok">Total pagado: {money(sumPosted)}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Link href="/payments/made/new">
            <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
              <Plus className="mr-2 h-4 w-4" /> Nuevo pago
            </Button>
          </Link>
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<HandCoins className="h-5 w-5 text-purple-600" />}
          title="Listado de Pagos Realizados"
          subtitle="Buscá por beneficiario / tipo / método / referencia. Podés incluir anulados."
        />

        <Separator className="my-4" />

        {/* FILTERS */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar (beneficiario, tipo, método, ref, id...)"
            className="max-w-xl bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex items-center gap-2">
            <input
              id="includeCancelled"
              type="checkbox"
              className="h-4 w-4"
              checked={includeCancelled}
              onChange={(e) => setIncludeCancelled(e.target.checked)}
            />
            <label htmlFor="includeCancelled" className="text-sm text-gray-700 select-none">
              Incluir anulados
            </label>
          </div>
        </div>

        <Separator className="my-4" />

        {/* DATAGRID premium container */}
        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-320px)] w-full">
              <DataGrid
                rows={visibleRows}
                columns={cols}
                getRowId={(r: PaymentMadeRow): GridRowId => r.id}
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
          Tip: “Con factura” significa que el pago aplicó a CxP (APInvoices). “Sin factura” es para sueldos/IPS/impuestos/otros.
        </div>
      </Card>
    </PageShell>
  );
}
