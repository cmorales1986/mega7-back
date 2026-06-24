"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";

import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import {
  ArrowLeft,
  RefreshCcw,
  PackageSearch,
  Warehouse,
  FileText,
  FileDown,
} from "lucide-react";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ✅ componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type ProductMini = { id: number; code: string; name: string };

type StockEntryLineUI = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;

  quantity: number;
  unitCost: number;
  taxRate: number;

  warehouseName: string;

  batchNumber?: string | null;
  expirationDate?: string | null;

  serialNumbers?: string | null;

  lineTotal: number;
};

type StockEntryDetailUI = {
  id: number;
  entryDate: string | null;
  entryMode: "ADD" | "SET";
  documentType: string;
  documentNumber: string;

  warehouseName: string;

  supplierName?: string | null;
  documentRef?: string | null;
  notes?: string | null;

  lines: StockEntryLineUI[];
};

export default function StockEntryDetailPage() {
  const router = useRouter();
  const params = useParams();

  const idNum = useMemo(() => Number((params as any)?.id ?? NaN), [params]);

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<StockEntryDetailUI | null>(null);

  const [productMap, setProductMap] = useState<Record<number, { code: string; name: string }>>({});

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

  async function ensureProductMap() {
    if (productMap && Object.keys(productMap).length > 0) return productMap;

    const pres = await api.get("/products");
    const list: ProductMini[] = pres.data ?? [];

    const map: Record<number, { code: string; name: string }> = {};
    for (const p of list) map[p.id] = { code: p.code ?? "", name: p.name ?? "" };

    setProductMap(map);
    return map;
  }

  async function loadData() {
    if (!idNum || Number.isNaN(idNum)) {
      Swal.fire("Error", "ID inválido", "error");
      return;
    }

    setLoading(true);
    try {
      const pMap = await ensureProductMap();

      const res = await api.get(`/stockentry/${idNum}`);
      const x = res.data;

      const headerWarehouseName =
        x?.warehouseName ??
        x?.WarehouseName ??
        x?.warehouse?.name ??
        x?.Warehouse?.Name ??
        "";

      const rawLines: any[] = x?.lines ?? x?.Lines ?? [];

      const mappedLines: StockEntryLineUI[] = rawLines.map((ln: any, idx: number) => {
        const pid = Number(ln?.productId ?? ln?.ProductId ?? 0);

        const apiCode =
          ln?.productCode ??
          ln?.ProductCode ??
          ln?.product?.code ??
          ln?.Product?.Code ??
          "";

        const apiName =
          ln?.productName ??
          ln?.ProductName ??
          ln?.product?.name ??
          ln?.Product?.Name ??
          "";

        const fallback = pMap[pid];

        const qty = Number(ln?.quantity ?? ln?.Quantity ?? 0);
        const cost = Number(ln?.unitCost ?? ln?.UnitCost ?? 0);

        const wName =
          ln?.warehouseName ??
          ln?.WarehouseName ??
          ln?.warehouse?.name ??
          ln?.Warehouse?.Name ??
          headerWarehouseName ??
          "";

        const lineTotal =
          (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(cost) ? cost : 0);

        return {
          id: ln?.id ?? ln?.Id ?? idx + 1,
          productId: pid,
          productCode: (apiCode || fallback?.code || "").trim(),
          productName: (apiName || fallback?.name || "").trim(),

          quantity: qty,
          unitCost: cost,
          taxRate: Number(ln?.taxRate ?? ln?.TaxRate ?? 0),

          warehouseName: wName,

          batchNumber: ln?.batchNumber ?? ln?.BatchNumber ?? null,
          expirationDate: ln?.expirationDate ?? ln?.ExpirationDate ?? null,

          serialNumbers: ln?.serialNumbers ?? ln?.SerialNumbers ?? null,

          lineTotal,
        };
      });

      const mapped: StockEntryDetailUI = {
        id: x?.id ?? x?.Id ?? idNum,
        entryDate: x?.entryDate ?? x?.EntryDate ?? null,
        entryMode: ((x?.entryMode ?? x?.EntryMode ?? "ADD") + "")
          .trim()
          .toUpperCase() as "ADD" | "SET",
        documentType: x?.documentType ?? x?.DocumentType ?? "",
        documentNumber: x?.documentNumber ?? x?.DocumentNumber ?? "",
        warehouseName: headerWarehouseName,
        supplierName: x?.supplierName ?? x?.SupplierName ?? "",
        documentRef: x?.documentRef ?? x?.DocumentRef ?? "",
        notes: x?.notes ?? x?.Notes ?? "",
        lines: mappedLines,
      };

      setEntry(mapped);
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data ?? "No se pudo cargar la entrada", "error");
      setEntry(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!Number.isNaN(idNum)) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum]);

  const totals = useMemo(() => {
    const lines = entry?.lines ?? [];
    const linesCount = lines.length;
    const qtyTotal = lines.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
    const total = lines.reduce((acc, l) => acc + Number(l.lineTotal ?? 0), 0);
    return { linesCount, qtyTotal, total };
  }, [entry]);

  const modeLabel =
    entry?.entryMode === "SET" ? "SET - Ajuste por conteo" : "ADD - Ingreso manual";

  const exportExcel = () => {
    const data = (entry?.lines ?? []).map((l) => ({
      productCode: l.productCode,
      productName: l.productName,
      quantity: l.quantity,
      unitCost: l.unitCost,
      lineTotal: l.lineTotal,
      batchNumber: l.batchNumber ?? "",
      expirationDate: l.expirationDate ?? "",
      serialNumbers: l.serialNumbers ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), `StockEntry_${idNum}.xlsx`);
  };

  const exportCSV = () => {
    const data = (entry?.lines ?? []).map((l) => ({
      productCode: l.productCode,
      productName: l.productName,
      quantity: l.quantity,
      unitCost: l.unitCost,
      lineTotal: l.lineTotal,
      batchNumber: l.batchNumber ?? "",
      expirationDate: l.expirationDate ?? "",
      serialNumbers: l.serialNumbers ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `StockEntry_${idNum}.csv`);
  };

  const columns: GridColDef[] = [
    { field: "productCode", headerName: "Código", width: 140 },
    { field: "productName", headerName: "Producto", flex: 1, minWidth: 280 },

    {
      field: "quantity",
      headerName: "Cant.",
      width: 110,
      headerAlign: "center",
      align: "center",
      valueFormatter: (arg: any) => fmtNumber(arg),
    },
    {
      field: "unitCost",
      headerName: "Costo Unit.",
      width: 150,
      headerAlign: "right",
      align: "right",
      valueFormatter: (arg: any) => fmtNumber(arg),
    },
    {
      field: "lineTotal",
      headerName: "Total",
      width: 150,
      headerAlign: "right",
      align: "right",
      valueFormatter: (arg: any) => fmtNumber(arg),
    },
    {
      field: "lotSerial",
      headerName: "Lote/Serie",
      width: 260,
      renderCell: (params: any) => {
        const r = params?.row as StockEntryLineUI | undefined;

        const batch = (r?.batchNumber ?? "").trim();
        const serial = (r?.serialNumbers ?? "").trim();

        if (batch) {
          return (
            <div className="text-xs leading-5">
              <div>
                <span className="font-semibold">Lote:</span> {batch}
              </div>
              {r?.expirationDate ? (
                <div className="text-gray-600">Vence: {fmtDate(r.expirationDate)}</div>
              ) : null}
            </div>
          );
        }

        if (serial) {
          const count = serial
            .split(/,|\n|\r|;/)
            .map((x) => x.trim())
            .filter(Boolean).length;

          return (
            <div className="text-xs">
              <span className="font-semibold">Series:</span> {count}
            </div>
          );
        }

        return <span className="text-gray-500 text-xs">—</span>;
      },
    },
  ];

  return (
    <PageShell
      icon={<PackageSearch className="h-5 w-5 text-slate-700" />}
      title={`Entrada #${Number.isFinite(idNum) ? idNum : "—"}`}
      subtitle="Detalle de cabecera + líneas del ingreso"
      chips={
        <>
          <Chip tone="neutral">Modo: {entry?.entryMode ?? "—"}</Chip>
          <Chip tone="neutral">Líneas: {totals.linesCount}</Chip>
          <Chip tone="neutral">Cant.: {fmtPY.format(totals.qtyTotal)}</Chip>
          <Chip tone="neutral">Total: {fmtPY.format(totals.total)}</Chip>
        </>
      }
      right={
        <>
          <Button variant="outline" onClick={() => router.push("/stock-entry")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Button onClick={loadData} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 hover:bg-blue-700 text-white">
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>
        </>
      }
    >
      {/* RESUMEN */}
      <div className="bg-white rounded-xl shadow border p-5 space-y-4">
        <SectionHeader
          icon={<FileText className="h-5 w-5 text-slate-700" />}
          title="Resumen"
          subtitle={entry ? modeLabel : loading ? "Cargando..." : "Sin datos"}
        />

        {!entry ? (
          <div className="text-sm text-gray-600">
            {loading ? "Cargando..." : "No se encontraron datos para esta entrada."}
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-3">
              <div className="text-xs text-gray-500">Fecha</div>
              <div className="font-medium">{fmtDate(entry.entryDate)}</div>
            </div>

            <div className="col-span-5">
              <div className="text-xs text-gray-500">Depósito</div>
              <div className="font-medium flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-gray-500" />
                <span>{entry.warehouseName || "—"}</span>
              </div>
            </div>

            <div className="col-span-4">
              <div className="text-xs text-gray-500">Documento</div>
              <div className="font-medium">
                {entry.documentType} - {entry.documentNumber}
              </div>
            </div>

            <div className="col-span-4">
              <div className="text-xs text-gray-500">Proveedor</div>
              <div className="font-medium">{entry.supplierName || "—"}</div>
            </div>

            <div className="col-span-8">
              <div className="text-xs text-gray-500">Referencia</div>
              <div className="font-medium">{entry.documentRef || "—"}</div>
            </div>

            <div className="col-span-12">
              <div className="text-xs text-gray-500">Notas</div>
              <div className="font-medium">{entry.notes || "—"}</div>
            </div>
          </div>
        )}
      </div>

      {/* LÍNEAS */}
      <div className="bg-white rounded-xl shadow border p-5">
        <SectionHeader
          icon={<PackageSearch className="h-5 w-5 text-slate-700" />}
          title="Líneas"
          subtitle="Productos cargados en el ingreso"
        />

        <ThemeProvider theme={muiTheme}>
          <div className="mt-4 h-[520px]">
            <DataGrid
              rows={entry?.lines ?? []}
              columns={columns}
              loading={loading}
              getRowId={(r) => (r as any).id}
              pageSizeOptions={[5, 10, 20, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
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
