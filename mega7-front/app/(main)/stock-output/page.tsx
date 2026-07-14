"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { FileDown, Plus, RefreshCcw, Eye, PackageMinus } from "lucide-react";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type StockOutputListRow = {
  id: number;
  outputDate: string | null;
  documentType: string;
  documentNumber: string;
  warehouseName: string;
  linesCount: number;
  qtyTotal: number;
};

export default function StockOutputListPage() {
  const router = useRouter();

  const [rows, setRows] = useState<StockOutputListRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState("");

  const fmtNumber = (arg: any) => {
    const v = arg?.value ?? arg;
    const n = Number(v ?? 0);
    return fmtPY.format(Number.isFinite(n) ? n : 0);
  };

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-PY");
  };

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/stockoutput");
      const list = res.data ?? [];

      const mapped: StockOutputListRow[] = list.map((x: any) => {
        const id = x.id ?? x.Id ?? 0;
        const outputDate = x.outputDate ?? x.OutputDate ?? null;

        const documentType = (x.documentType ?? x.DocumentType ?? "").toString();
        const documentNumber = (x.documentNumber ?? x.DocumentNumber ?? "").toString();

        const warehouseName =
          x.warehouseName ??
          x.WarehouseName ??
          x.warehouse?.name ??
          x.Warehouse?.Name ??
          "";

        const linesCount = Number(x.linesCount ?? x.LinesCount ?? 0);
        const qtyTotal = Number(x.qtyTotal ?? x.QtyTotal ?? 0);

        return {
          id,
          outputDate,
          documentType,
          documentNumber,
          warehouseName,
          linesCount,
          qtyTotal,
        };
      });

      setRows(mapped);
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data ?? "No se pudo cargar salidas", "error");
    } finally {
      setLoading(false);
    }
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
        (r.warehouseName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const chips = useMemo(() => {
    const linesCount = filtered.reduce((acc, r) => acc + Number(r.linesCount ?? 0), 0);
    const qtyTotal = filtered.reduce((acc, r) => acc + Number(r.qtyTotal ?? 0), 0);
    return { docs: filtered.length, linesCount, qtyTotal };
  }, [filtered]);

  const exportExcel = () => {
    const data = filtered.map((r) => ({
      id: r.id,
      outputDate: r.outputDate ?? "",
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      warehouse: r.warehouseName,
      lines: r.linesCount,
      qtyTotal: r.qtyTotal,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salidas");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "StockOutputs.xlsx");
  };

  const exportCSV = () => {
    const data = filtered.map((r) => ({
      id: r.id,
      outputDate: r.outputDate ?? "",
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      warehouse: r.warehouseName,
      lines: r.linesCount,
      qtyTotal: r.qtyTotal,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "StockOutputs.csv");
  };

  const canCreate = usePermission("StockOutput.Create");

  const columns: GridColDef[] = [
    { field: "id", headerName: "ID", width: 80 },

    {
      field: "outputDate",
      headerName: "Fecha",
      width: 120,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => fmtDate(params?.row?.outputDate),
    },

    { field: "warehouseName", headerName: "Depósito", width: 220 },
    { field: "documentType", headerName: "Doc.", width: 130 },
    { field: "documentNumber", headerName: "Nro", width: 160 },

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
          onClick={() => router.push(`/stock-output/${params?.row?.id}`)}
          title="Ver"
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const dynamicHeight =
    filtered.length <= 5 ? 330 : filtered.length <= 10 ? 470 : filtered.length <= 20 ? 650 : 780;

  return (
    <PageShell
      icon={<PackageMinus className="h-5 w-5 text-slate-700" />}
      title="Salidas de Stock"
      subtitle="Movimientos de egreso por documento"
      chips={
        <>
          <Chip tone="neutral">Docs: {chips.docs}</Chip>
          <Chip tone="neutral">Líneas: {chips.linesCount}</Chip>
          <Chip tone="neutral">Cant.: {fmtPY.format(chips.qtyTotal)}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button onClick={exportExcel} className="bg-green-600 text-white" disabled={loading}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 text-white" disabled={loading}>
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button
              onClick={() => router.push("/stock-output/new")}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva salida
            </Button>
          )}
        </>
      }
    >
      <div className="bg-white rounded-xl shadow border p-5">
        <SectionHeader
          icon={<PackageMinus className="h-5 w-5 text-slate-700" />}
          title="Listado"
          subtitle="Filtrá por depósito, documento o número"
        />

        <div className="mt-4 flex gap-3 items-center">
          <Input
            placeholder="Buscar por doc, depósito, nro..."
            className="max-w-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-gray-500">
            Exportación toma <b>lo filtrado</b>.
          </div>
        </div>

        <ThemeProvider theme={muiTheme}>
          <div className="mt-4 bg-white rounded-xl border" style={{ height: dynamicHeight }}>
            <DataGrid
              rows={filtered}
              columns={columns}
              loading={loading}
              getRowId={(r) => (r as any).id}
              pageSizeOptions={[5, 10, 20, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
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
