"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import Link from "next/link";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-shell";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { RefreshCcw, Plus, Eye, Truck } from "lucide-react";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type StockTransferListRow = {
  id: number;
  transferDate: string | null;
  fromWarehouseName: string;
  toWarehouseName: string;
  linesCount: number;
  qtyTotal: number;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
}

export default function StockTransferListPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockTransferListRow[]>([]);

  // filtros simples
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      // tu controller: GET api/StockTransfer
      const res = await api.get("/StockTransfer");
      const raw: any[] = res.data ?? [];

      const mapped: StockTransferListRow[] = raw.map((x: any) => {
        const rawLines: any[] = x?.lines ?? x?.Lines ?? [];

        const fromName =
          x?.fromWarehouseName ??
          x?.FromWarehouseName ??
          x?.fromWarehouse?.name ??
          x?.FromWarehouse?.Name ??
          "";

        const toName =
          x?.toWarehouseName ??
          x?.ToWarehouseName ??
          x?.toWarehouse?.name ??
          x?.ToWarehouse?.Name ??
          "";

        const qtyTotal = rawLines.reduce(
          (acc, l) => acc + Number(l?.quantity ?? l?.Quantity ?? 0),
          0
        );

        return {
          id: x?.id ?? x?.Id ?? 0,
          transferDate: x?.transferDate ?? x?.TransferDate ?? null,
          fromWarehouseName: fromName,
          toWarehouseName: toName,
          linesCount: rawLines.length,
          qtyTotal,
        };
      });

      setRows(mapped);
    } catch (e: any) {
      Swal.fire(
        "Error",
        e?.response?.data ?? "No se pudo cargar transferencias",
        "error"
      );
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;

    return rows.filter((r) => {
      if (text) {
        const hay = `${r.id} ${r.fromWarehouseName} ${r.toWarehouseName}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }

      if (from || to) {
        const d = r.transferDate ? new Date(r.transferDate) : null;
        if (!d || isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }

      return true;
    });
  }, [rows, q, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const docs = filtered.length;
    const lines = filtered.reduce((acc, r) => acc + (r.linesCount ?? 0), 0);
    const qty = filtered.reduce((acc, r) => acc + Number(r.qtyTotal ?? 0), 0);
    return { docs, lines, qty };
  }, [filtered]);

  const canCreate = usePermission("StockTransfer.Create");

  const columns: GridColDef[] = [
    { field: "id", headerName: "ID", width: 90 },
    {
      field: "transferDate",
      headerName: "Fecha",
      width: 150,
      valueFormatter: (p: any) => fmtDate(p.value),
    },
    { field: "fromWarehouseName", headerName: "Origen", flex: 1, minWidth: 220 },
    { field: "toWarehouseName", headerName: "Destino", flex: 1, minWidth: 220 },
    {
      field: "linesCount",
      headerName: "Líneas",
      width: 110,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "qtyTotal",
      headerName: "Cant. total",
      width: 140,
      headerAlign: "center",
      align: "center",
      valueFormatter: (p: any) => fmtPY.format(Number(p.value ?? 0)),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 130,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => (
        <Button asChild variant="outline" size="sm" className="h-9 px-3">
          <Link href={`/stock-transfer/${params.row.id}`} title="Ver detalle">
            <Eye className="h-4 w-4 mr-2" />
            Ver
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Truck className="h-5 w-5" />}
      title="Transferencias"
      subtitle="Movimientos entre depósitos."
      right={
        <div className="flex gap-2">
          <Button onClick={load} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>

          {canCreate && (
            <Button asChild className="bg-blue-600 text-white">
              <Link href="/stock-transfer/new">
                <Plus className="mr-2 h-4 w-4" />
                Nueva
              </Link>
            </Button>
          )}
        </div>
      }
    >
      {/* filtros */}
      <div className="bg-white rounded-xl shadow border p-5">
        <div className="grid grid-cols-12 gap-4 items-end">
          <div className="col-span-6">
            <label className="text-sm font-medium">Buscar</label>
            <Input
              placeholder="ID, Origen o Destino..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-6 text-sm text-gray-700">
          <div>
            Docs: <b>{totals.docs}</b>
          </div>
          <div>
            Líneas: <b>{totals.lines}</b>
          </div>
          <div>
            Cantidad: <b>{fmtPY.format(totals.qty)}</b>
          </div>
        </div>
      </div>

      {/* grilla */}
      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow border p-4 h-[560px]">
          <DataGrid
            rows={filtered}
            columns={columns}
            loading={loading}
            getRowId={(r) => (r as any).id}
            pageSizeOptions={[10, 20, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
            disableRowSelectionOnClick
          />
        </div>
      </ThemeProvider>
    </PageShell>
  );
}
