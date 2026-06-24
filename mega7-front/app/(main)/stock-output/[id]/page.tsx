"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Swal from "sweetalert2";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { ArrowLeft, RefreshCcw, PackageMinus } from "lucide-react";
import { PageShell, Chip } from "@/components/ui/page-shell";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

type ProductMini = { id: number; code: string; name: string };

type StockOutputLineUI = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;

  quantity: number;
  warehouseName: string;

  batchNumber?: string | null;
  serialNumbers?: string | null;
};

type StockOutputDetailUI = {
  id: number;
  outputDate: string | null;
  documentType: string;
  documentNumber: string;

  warehouseName: string;
  notes?: string | null;

  lines: StockOutputLineUI[];
};

export default function StockOutputDetailPage() {
  const router = useRouter();
  const pathname = usePathname();

  const idNum = useMemo(() => {
    const last = (pathname ?? "").split("/").filter(Boolean).pop();
    return Number(last ?? NaN);
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState<StockOutputDetailUI | null>(null);

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

  const serialCount = (serial: string | null | undefined) =>
    (serial ?? "")
      .split(/,|\n|\r|;/)
      .map((x) => x.trim())
      .filter(Boolean).length;

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

      const res = await api.get(`/stockoutput/${idNum}`);
      const x = res.data;

      const headerWarehouseName =
        x?.warehouseName ??
        x?.WarehouseName ??
        x?.warehouse?.name ??
        x?.Warehouse?.Name ??
        "";

      const rawLines: any[] = x?.lines ?? x?.Lines ?? [];

      const mappedLines: StockOutputLineUI[] = rawLines.map((ln: any, idx: number) => {
        const pid = Number(ln?.productId ?? ln?.ProductId ?? 0);

        const apiCode =
          ln?.productCode ?? ln?.ProductCode ?? ln?.product?.code ?? ln?.Product?.Code ?? "";

        const apiName =
          ln?.productName ?? ln?.ProductName ?? ln?.product?.name ?? ln?.Product?.Name ?? "";

        const fallback = pMap[pid];

        const wName =
          ln?.warehouseName ??
          ln?.WarehouseName ??
          ln?.warehouse?.name ??
          ln?.Warehouse?.Name ??
          headerWarehouseName ??
          "";

        return {
          id: ln?.id ?? ln?.Id ?? idx + 1,
          productId: pid,
          productCode: (apiCode || fallback?.code || "").trim(),
          productName: (apiName || fallback?.name || "").trim(),
          quantity: Number(ln?.quantity ?? ln?.Quantity ?? 0),
          warehouseName: wName,
          batchNumber: ln?.batchNumber ?? ln?.BatchNumber ?? null,
          serialNumbers: ln?.serialNumbers ?? ln?.SerialNumbers ?? null,
        };
      });

      const mapped: StockOutputDetailUI = {
        id: x?.id ?? x?.Id ?? idNum,
        outputDate: x?.outputDate ?? x?.OutputDate ?? null,
        documentType: x?.documentType ?? x?.DocumentType ?? "",
        documentNumber: x?.documentNumber ?? x?.DocumentNumber ?? "",
        warehouseName: headerWarehouseName,
        notes: x?.notes ?? x?.Notes ?? "",
        lines: mappedLines,
      };

      setOutput(mapped);
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data ?? "No se pudo cargar la salida", "error");
      setOutput(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isNaN(idNum)) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum]);

  const totals = useMemo(() => {
    const lines = output?.lines ?? [];
    const linesCount = lines.length;
    const qtyTotal = lines.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
    const batches = lines.filter((l) => (l.batchNumber ?? "").trim()).length;
    const serials = lines.reduce((acc, l) => acc + serialCount(l.serialNumbers), 0);
    return { linesCount, qtyTotal, batches, serials };
  }, [output]);

  const columns: GridColDef[] = [
    { field: "productCode", headerName: "Código", width: 140 },
    { field: "productName", headerName: "Producto", flex: 1, minWidth: 260 },
    {
      field: "quantity",
      headerName: "Cant.",
      width: 120,
      headerAlign: "center",
      align: "center",
      valueFormatter: (arg: any) => fmtNumber(arg),
    },
    {
      field: "lotSerial",
      headerName: "Lote/Serie",
      width: 320,
      renderCell: (params: any) => {
        const r = params?.row as StockOutputLineUI | undefined;
        const batch = (r?.batchNumber ?? "").trim();
        const serial = (r?.serialNumbers ?? "").trim();

        if (batch) {
          return (
            <span className="text-xs" title={`Lote: ${batch}`}>
              <b>Lote:</b> {batch}
            </span>
          );
        }

        if (serial) {
          const count = serialCount(serial);
          return (
            <span className="text-xs" title={serial}>
              <b>Series:</b> {count} <span className="text-gray-500">(hover para ver)</span>
            </span>
          );
        }

        return <span className="text-gray-500 text-xs">—</span>;
      },
    },
  ];

  return (
    <PageShell
      icon={<PackageMinus className="h-5 w-5" />}
      title={`Salida #${idNum}`}
      subtitle="Detalle del documento y líneas retiradas del inventario."
      chips={
        <>
          <Chip tone="neutral">Líneas: {totals.linesCount}</Chip>
          <Chip tone="neutral">Cant.: {fmtPY.format(totals.qtyTotal)}</Chip>
          <Chip tone="neutral">Lotes: {totals.batches}</Chip>
          <Chip tone="neutral">Series: {totals.serials}</Chip>
        </>
      }
      right={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/stock-output")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <Button onClick={loadData} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
        </div>
      }
    >
      <div className="bg-white rounded-xl shadow p-5 border">
        {!output ? (
          <div className="text-gray-600">{loading ? "Cargando..." : "Sin datos"}</div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-3">
              <div className="text-xs text-gray-500">Fecha</div>
              <div className="font-medium">{fmtDate(output.outputDate)}</div>
            </div>

            <div className="col-span-4">
              <div className="text-xs text-gray-500">Depósito</div>
              <div className="font-medium">{output.warehouseName || "—"}</div>
            </div>

            <div className="col-span-5">
              <div className="text-xs text-gray-500">Documento</div>
              <div className="font-medium">
                {output.documentType} - {output.documentNumber}
              </div>
            </div>

            <div className="col-span-12">
              <div className="text-xs text-gray-500">Notas</div>
              <div className="font-medium">{output.notes || "—"}</div>
            </div>
          </div>
        )}
      </div>

      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow p-4 border h-[520px]">
          <DataGrid
            rows={output?.lines ?? []}
            columns={columns}
            loading={loading}
            getRowId={(r) => (r as any).id}
            pageSizeOptions={[5, 10, 20, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
          />
        </div>
      </ThemeProvider>
    </PageShell>
  );
}
