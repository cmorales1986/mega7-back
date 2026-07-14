"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// MUI
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { FileDown, Plus, RefreshCcw, Eye, Boxes, Search } from "lucide-react";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ✅ componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// ✅ DTO alineado a columnas: linesCount, qtyTotal, total
type StockEntryListRow = {
  id: number;
  entryDate: string | null;
  entryMode: "ADD" | "SET";
  documentType: string;
  documentNumber: string;
  warehouseName: string;
  supplierName?: string | null;
  documentRef?: string | null;
  notes?: string | null;

  linesCount: number;
  qtyTotal: number;
  total: number;
};

export default function StockEntryListPage() {
  const router = useRouter();

  const [rows, setRows] = useState<StockEntryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fmtNumber = (arg: any) => {
    const v = arg?.value ?? arg;
    const n = Number(v ?? 0);
    return fmtPY.format(Number.isFinite(n) ? n : 0);
  };

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/stockentry");
      const list = res.data ?? [];

      const mapped: StockEntryListRow[] = list.map((x: any) => {
        const id = x.id ?? x.Id ?? 0;
        const entryDate = x.entryDate ?? x.EntryDate ?? null;

        const entryMode = (x.entryMode ?? x.EntryMode ?? "ADD")
          .toString()
          .toUpperCase() as "ADD" | "SET";

        const documentType = x.documentType ?? x.DocumentType ?? "";
        const documentNumber = x.documentNumber ?? x.DocumentNumber ?? "";

        const supplierName = x.supplierName ?? x.SupplierName ?? "";
        const documentRef = x.documentRef ?? x.DocumentRef ?? "";
        const notes = x.notes ?? x.Notes ?? "";

        const warehouseName =
          x.warehouseName ??
          x.WarehouseName ??
          x.warehouse?.name ??
          x.Warehouse?.Name ??
          "";

        const linesCount = Number(x.linesCount ?? x.LinesCount ?? 0);
        const qtyTotal = Number(x.qtyTotal ?? x.QtyTotal ?? 0);
        const total = Number(x.total ?? x.Total ?? 0);

        return {
          id,
          entryDate,
          entryMode,
          documentType,
          documentNumber,
          warehouseName,
          supplierName,
          documentRef,
          notes,
          linesCount,
          qtyTotal,
          total,
        };
      });

      setRows(mapped);
    } catch (err: any) {
      Swal.fire(
        "Error",
        err?.response?.data ?? "No se pudo cargar entradas",
        "error"
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.id).includes(q) ||
        (r.documentType ?? "").toLowerCase().includes(q) ||
        (r.documentNumber ?? "").toLowerCase().includes(q) ||
        (r.warehouseName ?? "").toLowerCase().includes(q) ||
        (r.supplierName ?? "").toLowerCase().includes(q) ||
        (r.entryMode ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const statsAll = useMemo(() => {
    const total = rows.length;
    const add = rows.filter((x) => x.entryMode === "ADD").length;
    const set = rows.filter((x) => x.entryMode === "SET").length;
    const qty = rows.reduce((a, b) => a + Number(b.qtyTotal ?? 0), 0);
    const amount = rows.reduce((a, b) => a + Number(b.total ?? 0), 0);
    return { total, add, set, qty, amount };
  }, [rows]);

  const statsFiltered = useMemo(() => {
    const total = filtered.length;
    const add = filtered.filter((x) => x.entryMode === "ADD").length;
    const set = filtered.filter((x) => x.entryMode === "SET").length;
    const qty = filtered.reduce((a, b) => a + Number(b.qtyTotal ?? 0), 0);
    const amount = filtered.reduce((a, b) => a + Number(b.total ?? 0), 0);
    return { total, add, set, qty, amount };
  }, [filtered]);

  const exportExcel = () => {
    const data = filtered.map((r) => ({
      id: r.id,
      entryDate: r.entryDate ?? "",
      entryMode: r.entryMode,
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      warehouse: r.warehouseName,
      supplier: r.supplierName ?? "",
      lines: r.linesCount,
      qtyTotal: r.qtyTotal,
      total: r.total,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entradas");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "StockEntries.xlsx");
  };

  const exportCSV = () => {
    const data = filtered.map((r) => ({
      id: r.id,
      entryDate: r.entryDate ?? "",
      entryMode: r.entryMode,
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      warehouse: r.warehouseName,
      supplier: r.supplierName ?? "",
      lines: r.linesCount,
      qtyTotal: r.qtyTotal,
      total: r.total,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "StockEntries.csv");
  };

  const canCreate = usePermission("StockEntry.Create");

  const columns: GridColDef[] = [
    { field: "id", headerName: "ID", width: 80 },

    {
      field: "entryDate",
      headerName: "Fecha",
      width: 120,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => {
        const v = params?.row?.entryDate;
        if (!v) return "";
        const d = new Date(v);
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
      },
    },

    {
      field: "entryMode",
      headerName: "Tipo",
      width: 240,
      renderCell: (params: any) => {
        const v = String(params?.value ?? "").toUpperCase();
        return (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              v === "SET"
                ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200"
            }`}
          >
            {v === "SET"
              ? "SET - Ajuste por conteo"
              : "ADD - Ingreso / Ajuste"}
          </span>
        );
      },
    },

    { field: "warehouseName", headerName: "Depósito", width: 210 },
    { field: "documentType", headerName: "Doc.", width: 140 },
    { field: "documentNumber", headerName: "Nro", width: 160 },
    { field: "supplierName", headerName: "Proveedor", width: 240 },

    {
      field: "linesCount",
      headerName: "Líneas",
      width: 100,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "qtyTotal",
      headerName: "Cant.",
      width: 120,
      headerAlign: "center",
      align: "center",
      valueFormatter: (arg: any) => fmtNumber(arg),
    },
    {
      field: "total",
      headerName: "Total",
      width: 150,
      headerAlign: "center",
      align: "center",
      valueFormatter: (arg: any) => fmtNumber(arg),
    },

    {
      field: "actions",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => (
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => router.push(`/stock-entry/${params?.row?.id}`)}
          title="Ver"
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Boxes className="h-5 w-5 text-slate-700" />}
      title="Entradas de Stock"
      subtitle="Ajustes / Ingresos manuales (recomendado: compras por Purchase Receipts)"
      chips={
        <>
          <Chip tone="neutral">Total: {statsAll.total}</Chip>
          <Chip tone="ok">ADD: {statsAll.add}</Chip>
          <Chip tone="neutral">SET: {statsAll.set}</Chip>
          <Chip tone="neutral">Cant.: {fmtPY.format(statsAll.qty)}</Chip>
          <Chip tone="neutral">Total: {fmtPY.format(statsAll.amount)}</Chip>

          <span className="mx-1 text-slate-300">|</span>

          <Chip tone="neutral">Filtrado: {statsFiltered.total}</Chip>
          <Chip tone="neutral">Cant.: {fmtPY.format(statsFiltered.qty)}</Chip>
          <Chip tone="neutral">Total: {fmtPY.format(statsFiltered.amount)}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={exportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button
            onClick={exportCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button
              onClick={() => router.push("/stock-entry/new")}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo ingreso
            </Button>
          )}
        </>
      }
    >
      {/* SEARCH */}
      <div className="bg-white rounded-xl border shadow p-4 space-y-4">
        <SectionHeader
          icon={<Search className="h-5 w-5 text-slate-700" />}
          title="Búsqueda"
          subtitle="Filtrá por doc, depósito, proveedor, modo o ID"
        />

        <Input
          placeholder="Buscar por doc, depósito, proveedor, modo..."
          className="max-w-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* GRID */}
      <div className="bg-white rounded-xl border shadow p-3">
        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 620, width: "100%" }}>
            <DataGrid
              rows={filtered}
              columns={columns}
              loading={loading}
              getRowId={(r) => (r as any).id}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
              }}
              disableRowSelectionOnClick
              slots={{ toolbar: GridToolbar }}
              slotProps={{
                toolbar: {
                  showQuickFilter: true,
                  quickFilterProps: { debounceMs: 400 },
                } as any,
              }}
              sx={{
                border: "none",
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "#fafafa",
                  borderBottom: "1px solid #eee",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid #f2f2f2",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#fcfcfc",
                },
              }}
            />
          </div>
        </ThemeProvider>
      </div>
    </PageShell>
  );
}
