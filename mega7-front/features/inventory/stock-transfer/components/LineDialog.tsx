// src/features/inventory/stock-transfer/components/LineDialog.tsx
"use client";

import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { Product, StockTransferLine } from "../types";
import { fmtPY, onlyDigits, splitSerials } from "../utils";
import { SerialPickerDialog } from "./SerialPickerDialog";

type BatchPickDto = { id: number; batchNumber: string; quantity: number; expirationDate?: string | null };
type SerialPickDto = { id: number; serialNumber: string; isActive: boolean };

export function LineDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  products: Product[];
  fromWarehouseId: number;
  toWarehouseId: number;

  editing?: StockTransferLine | null;
  onSave: (line: StockTransferLine) => void;

  loadBatches: (productId: number, whId: number) => Promise<BatchPickDto[]>;
  loadSerials: (productId: number, whId: number) => Promise<SerialPickDto[]>;
}) {
  const {
    open,
    onOpenChange,
    products,
    fromWarehouseId,
    toWarehouseId,
    editing,
    onSave,
    loadBatches,
    loadSerials,
  } = props;

  const [productId, setProductId] = React.useState<number | "">("");
  const [qty, setQty] = React.useState("1");
  const [batchNumber, setBatchNumber] = React.useState("");
  const [selectedSerials, setSelectedSerials] = React.useState<string[]>([]);

  const [batchOptions, setBatchOptions] = React.useState<BatchPickDto[]>([]);
  const [serialOptions, setSerialOptions] = React.useState<SerialPickDto[]>([]);
  const [openSerialPicker, setOpenSerialPicker] = React.useState(false);

  const selectedProduct = React.useMemo(() => {
    if (!productId) return null;
    return products.find((p) => p.id === Number(productId)) ?? null;
  }, [productId, products]);

  React.useEffect(() => {
    // on open => preload edit
    if (!open) return;

    if (editing) {
      setProductId(editing.productId);
      setQty(String(editing.quantity ?? 0));
      setBatchNumber(editing.batchNumber ?? "");
      setSelectedSerials(splitSerials(editing.serialNumbers));
    } else {
      setProductId("");
      setQty("1");
      setBatchNumber("");
      setSelectedSerials([]);
    }

    setBatchOptions([]);
    setSerialOptions([]);
  }, [open, editing]);

  async function onChangeProduct(v: number | "") {
    setProductId(v);
    setBatchNumber("");
    setSelectedSerials([]);
    setBatchOptions([]);
    setSerialOptions([]);

    if (!v) return;
    const p = products.find((x) => x.id === Number(v));
    if (!p) return;

    try {
      if (p.isBatchManaged) setBatchOptions(await loadBatches(Number(v), fromWarehouseId));
      if (p.isSerialManaged) setSerialOptions(await loadSerials(Number(v), fromWarehouseId));
    } catch {
      Swal.fire("Error", "No se pudo cargar lotes/seriales disponibles", "error");
    }
  }

  function validate(): string | null {
    if (!productId) return "Seleccione un producto.";
    const q = Number(qty ?? 0);
    if (!q || q <= 0) return "Cantidad debe ser mayor a 0.";

    const p = products.find((x) => x.id === Number(productId));
    if (!p) return "Producto inválido.";

    if (p.isBatchManaged) {
      if (!batchNumber.trim()) return "El producto es loteable. Debe seleccionar un lote.";
      const b = batchOptions.find((x) => (x.batchNumber ?? "").trim() === batchNumber.trim());
      if (!b) return "Lote inválido para este depósito.";
      if (q > Number(b.quantity ?? 0))
        return `Stock insuficiente en el lote ${b.batchNumber}. Disponible: ${fmtPY.format(
          Number(b.quantity ?? 0)
        )}`;
    }

    if (p.isSerialManaged) {
      const unique = Array.from(new Set(selectedSerials));
      if (unique.length === 0) return "El producto es serializable. Debe seleccionar seriales.";
      if (unique.length !== q)
        return `Cantidad de seriales (${unique.length}) debe coincidir con Quantity (${q}).`;
    }

    return null;
  }

  function save() {
    const err = validate();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    const p = products.find((x) => x.id === Number(productId))!;
    const q = Number(qty ?? 0);

    onSave({
      productId: Number(productId),
      quantity: q,
      batchNumber: p.isBatchManaged ? batchNumber.trim() : null,
      serialNumbers: p.isSerialManaged ? Array.from(new Set(selectedSerials)).join(",") : null,
      fromWarehouseId,
      toWarehouseId,
    });

    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar línea" : "Agregar línea"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <label className="text-sm font-medium">Producto</label>
                <select
                  className="w-full h-10 rounded-md border px-3"
                  value={productId}
                  onChange={(e) => onChangeProduct(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Seleccionar</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4">
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => {
                    const v = onlyDigits(e.target.value);
                    setQty(v);

                    const q = Number(v || 0);
                    if (q >= 0 && selectedSerials.length > q) {
                      setSelectedSerials(selectedSerials.slice(0, q));
                    }
                  }}
                />
              </div>
            </div>

            {selectedProduct?.isBatchManaged && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-8">
                  <label className="text-sm font-medium">Lote disponible</label>
                  <select
                    className="w-full h-10 rounded-md border px-3"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.batchNumber}>
                        {b.batchNumber} (Disp: {fmtPY.format(Number(b.quantity ?? 0))})
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    Solo se muestran lotes con stock &gt; 0 en el depósito origen.
                  </div>
                </div>

                <div className="col-span-4">
                  <label className="text-sm font-medium">Disponible</label>
                  <div className="h-10 rounded-md border px-3 flex items-center bg-gray-50">
                    {(() => {
                      const b = batchOptions.find((x) => x.batchNumber === batchNumber);
                      return b ? fmtPY.format(Number(b.quantity ?? 0)) : "—";
                    })()}
                  </div>
                </div>
              </div>
            )}

            {selectedProduct?.isSerialManaged && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm font-medium">Seriales</label>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const q = Number(qty || 0);
                        if (!q || q <= 0) {
                          Swal.fire("Validación", "Primero cargá la cantidad.", "warning");
                          return;
                        }
                        setOpenSerialPicker(true);
                      }}
                    >
                      Seleccionar seriales
                    </Button>

                    <div className="text-sm text-gray-600">
                      Seleccionados: <b>{selectedSerials.length}</b> / {Number(qty || 0)}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-2">
                    {selectedSerials.length > 0
                      ? `Elegidos: ${selectedSerials.slice(0, 8).join(", ")}${
                          selectedSerials.length > 8 ? "..." : ""
                        }`
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="bg-[#2563eb] text-white" onClick={save}>
                Guardar línea
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SerialPickerDialog
        open={openSerialPicker}
        onOpenChange={setOpenSerialPicker}
        options={serialOptions}
        qty={Number(qty || 0)}
        selected={selectedSerials}
        setSelected={setSelectedSerials}
      />
    </>
  );
}

import React from "react";
