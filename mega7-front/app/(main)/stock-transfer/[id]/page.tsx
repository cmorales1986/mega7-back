// app/stock-transfer/[id]/page.tsx
"use client";

import Swal from "sweetalert2";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { ArrowLeft, RefreshCcw, Truck } from "lucide-react";

import { getProducts, getTransferById } from "@/features/inventory/stock-transfer/api";
import { mapTransferDetail } from "@/features/inventory/stock-transfer/mappers";
import type { StockTransferDetailUI } from "@/features/inventory/stock-transfer/types";
import { fmtPY, fmtDatePY, splitSerials } from "@/features/inventory/stock-transfer/utils";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);

type ProductMini = { id: number; code: string; name: string };

export default function StockTransferDetailPage() {
  const router = useRouter();
  const pathname = usePathname();

  const idNum = useMemo(() => {
    const last = (pathname ?? "").split("/").filter(Boolean).pop();
    return Number(last ?? NaN);
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [transfer, setTransfer] = useState<StockTransferDetailUI | null>(null);
  const [productMap, setProductMap] = useState<Record<number, { code: string; name: string }>>({});

  async function ensureProductMap() {
    if (Object.keys(productMap).length) return productMap;

    const list: ProductMini[] = await getProducts();
    const map: Record<number, { code: string; name: string }> = {};
    for (const p of list) map[p.id] = { code: p.code ?? "", name: p.name ?? "" };

    setProductMap(map);
    return map;
  }

  async function load() {
    if (!idNum || Number.isNaN(idNum)) {
      Swal.fire("Error", "ID inválido", "error");
      return;
    }

    setLoading(true);
    try {
      const pMap = await ensureProductMap();
      const raw = await getTransferById(idNum);
      setTransfer(mapTransferDetail(raw, pMap, idNum));
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar la transferencia"), "error");
      setTransfer(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!Number.isNaN(idNum)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum]);

  const totals = useMemo(() => {
    const lines = transfer?.lines ?? [];
    return {
      linesCount: lines.length,
      qtyTotal: lines.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0),
    };
  }, [transfer]);

  const columns: GridColDef[] = [
    { field: "productCode", headerName: "Código", width: 140 },
    { field: "productName", headerName: "Producto", flex: 1, minWidth: 260 },
    {
      field: "quantity",
      headerName: "Cant.",
      width: 120,
      headerAlign: "center",
      align: "center",
      valueFormatter: (arg: any) => fmtPY.format(Number(arg?.value ?? 0)),
    },
    {
      field: "lotSerial",
      headerName: "Lote/Serie",
      width: 280,
      renderCell: (params: any) => {
        const r = params?.row as any;
        const batch = (r?.batchNumber ?? "").trim();
        const serial = (r?.serialNumbers ?? "").trim();

        if (batch) return <span className="text-xs"><b>Lote:</b> {batch}</span>;
        if (serial) return <span className="text-xs"><b>Series:</b> {splitSerials(serial).length}</span>;
        return <span className="text-gray-500 text-xs">—</span>;
      },
    },
  ];

  return (
    <PageShell
      icon={<Truck className="h-5 w-5" />}
      title={`Transferencia #${idNum}`}
      subtitle="Detalle del movimiento entre depósitos."
      right={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/stock-transfer")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <Button onClick={load} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
        </div>
      }
    >
      <div className="bg-white rounded-xl shadow p-5 border">
        {!transfer ? (
          <div className="text-gray-600">{loading ? "Cargando..." : "Sin datos"}</div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-3">
              <div className="text-xs text-gray-500">Fecha</div>
              <div className="font-medium">{fmtDatePY(transfer.transferDate)}</div>
            </div>

            <div className="col-span-4">
              <div className="text-xs text-gray-500">Origen</div>
              <div className="font-medium">{transfer.fromWarehouseName || "—"}</div>
            </div>

            <div className="col-span-5">
              <div className="text-xs text-gray-500">Destino</div>
              <div className="font-medium">{transfer.toWarehouseName || "—"}</div>
            </div>

            <div className="col-span-12 border-t pt-4 mt-2 flex gap-6">
              <div>
                <div className="text-xs text-gray-500">Líneas</div>
                <div className="font-semibold">{totals.linesCount}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Cant. total</div>
                <div className="font-semibold">{fmtPY.format(totals.qtyTotal)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow p-4 border h-[520px]">
          <DataGrid
            rows={transfer?.lines ?? []}
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