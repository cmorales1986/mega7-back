// app/stock-transfer/new/page.tsx
"use client";

import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-shell";
import { Plus, Pencil, Trash2, Save, RefreshCcw, Truck } from "lucide-react";

import { useMemo, useState } from "react";
import { useStockTransferForm } from "@/features/inventory/stock-transfer/hooks";
import type { StockTransferLine } from "@/features/inventory/stock-transfer/types";
import { splitSerials, fmtPY } from "@/features/inventory/stock-transfer/utils";
import { LineDialog } from "@/features/inventory/stock-transfer/components/LineDialog";

const muiTheme = createTheme({}, esES);

type LineRow = StockTransferLine & {
  _rowId: string;
  productLabel: string;
  batchOrSerial: string;
};

export default function StockTransferNewPage() {
  const router = useRouter();
  const f = useStockTransferForm();

  const [openLineModal, setOpenLineModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const editingLine = useMemo(() => {
    if (editingIndex === null) return null;
    return f.lines[editingIndex] ?? null;
  }, [editingIndex, f.lines]);

  const rows: LineRow[] = useMemo(() => {
    return f.lines.map((l, idx) => {
      const p = f.products.find((x) => x.id === l.productId);
      const label = p ? `${p.code} - ${p.name}` : `ID ${l.productId}`;

      let batchOrSerial = "";
      if (p?.isBatchManaged) batchOrSerial = `Lote: ${l.batchNumber ?? "-"}`;
      else if (p?.isSerialManaged) batchOrSerial = `Series: ${splitSerials(l.serialNumbers).length}`;

      return {
        ...l,
        _rowId: `${idx}-${l.productId}-${l.fromWarehouseId}-${l.toWarehouseId}`,
        productLabel: label,
        batchOrSerial,
      };
    });
  }, [f.lines, f.products]);

  const columns: GridColDef<LineRow>[] = [
    { field: "productLabel", headerName: "Producto", flex: 1, minWidth: 260 },
    {
      field: "quantity",
      headerName: "Cant.",
      width: 110,
      headerAlign: "center",
      align: "center",
      valueFormatter: (p: any) => fmtPY.format(Number(p.value ?? 0)),
    },
    { field: "batchOrSerial", headerName: "Lote/Series", width: 180 },
    {
      field: "actions",
      headerName: "Acciones",
      width: 150,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: GridRenderCellParams<LineRow>) => {
        const idx = rows.findIndex((r) => r._rowId === params.row._rowId);
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => {
                setEditingIndex(idx);
                setOpenLineModal(true);
              }}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-red-100 border-red-300 text-red-600"
              onClick={() => f.deleteLine(idx)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  async function onSave() {
    try {
      await f.save();
      Swal.fire("Ok", "Transferencia registrada correctamente.", "success");
      router.push("/stock-transfer");
    } catch (e: any) {
      const data = e?.response?.data;
      const msg =
        typeof data === "string"
          ? data
          : data?.title
          ? `${data.title}\n${JSON.stringify(data.errors ?? data, null, 2)}`
          : JSON.stringify(data ?? "Error", null, 2);

      Swal.fire("Error", msg, "error");
      console.error("POST /StockTransfer error:", data);
    }
  }

  return (
    <PageShell
      icon={<Truck className="h-5 w-5" />}
      title="Nueva Transferencia"
      subtitle="Mover stock entre depósitos (lotes y seriales soportados)."
      right={
        <div className="flex gap-3">
          <Button onClick={f.reloadLookups} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button onClick={onSave} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </div>
      }
    >
      {/* CABECERA */}
      <div className="bg-white rounded-xl shadow border p-6 space-y-3">
        {f.headerError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {f.headerError}
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4">
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={f.transferDate} onChange={(e) => f.setTransferDate(e.target.value)} />
          </div>

          <div className="col-span-4">
            <label className="text-sm font-medium">Depósito Origen</label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={f.fromWarehouseId}
              onChange={(e) => f.setFromWarehouseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Seleccionar</option>
              {f.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-4">
            <label className="text-sm font-medium">Depósito Destino</label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={f.toWarehouseId}
              onChange={(e) => f.setToWarehouseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Seleccionar</option>
              {f.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* LÍNEAS */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Líneas</h2>

        <Button
          onClick={() => {
            if (!f.fromWarehouseId || !f.toWarehouseId) {
              Swal.fire("Validación", "Seleccioná Origen y Destino en cabecera primero.", "warning");
              return;
            }
            if (f.fromWarehouseId === f.toWarehouseId) {
              Swal.fire("Validación", "Origen y destino no pueden ser iguales.", "warning");
              return;
            }
            setEditingIndex(null);
            setOpenLineModal(true);
          }}
          className="bg-blue-600 text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Agregar línea
        </Button>
      </div>

      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow border p-4 h-[520px]">
          <DataGrid
            rows={rows}
            columns={columns}
            loading={f.loading}
            getRowId={(r) => (r as any)._rowId}
            pageSizeOptions={[5, 10, 20]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
          />
        </div>
      </ThemeProvider>

      <LineDialog
        open={openLineModal}
        onOpenChange={(v) => {
          setOpenLineModal(v);
          if (!v) setEditingIndex(null);
        }}
        products={f.products}
        fromWarehouseId={Number(f.fromWarehouseId || 0)}
        toWarehouseId={Number(f.toWarehouseId || 0)}
        editing={editingLine}
        onSave={(line) => {
          if (editingIndex === null) f.addLine(line);
          else f.updateLine(editingIndex, line);
        }}
        loadBatches={f.loadBatches}
        loadSerials={f.loadSerials}
      />
    </PageShell>
  );
}
