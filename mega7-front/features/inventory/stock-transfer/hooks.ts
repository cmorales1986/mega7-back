// src/features/inventory/stock-transfer/hooks.ts
import Swal from "sweetalert2";
import { useEffect, useMemo, useState } from "react";
import type { Product, StockTransferLine, StockTransferCreatePayload, Warehouse } from "./types";
import { getProducts, getWarehouses, createTransfer, getBatchOptions, getSerialOptions } from "./api";
import { toISODateAtMidnight } from "./utils";

export function useStockTransferForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [transferDate, setTransferDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [fromWarehouseId, setFromWarehouseId] = useState<number | "">("");
  const [toWarehouseId, setToWarehouseId] = useState<number | "">("");
  const [lines, setLines] = useState<StockTransferLine[]>([]);

  async function reloadLookups() {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([getProducts(), getWarehouses()]);
      setProducts(p);
      setWarehouses(w);
    } catch {
      Swal.fire("Error", "No se pudo cargar productos/depósitos", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    reloadLookups();
  }, []);

  const headerError = useMemo(() => {
    if (!transferDate) return "TransferDate es obligatorio.";
    if (!fromWarehouseId) return "Debe seleccionar depósito origen.";
    if (!toWarehouseId) return "Debe seleccionar depósito destino.";
    if (fromWarehouseId === toWarehouseId) return "Origen y destino no pueden ser iguales.";
    return null;
  }, [transferDate, fromWarehouseId, toWarehouseId]);

  function addLine(l: StockTransferLine) {
    setLines((prev) => [...prev, l]);
  }

  function updateLine(index: number, l: StockTransferLine) {
    setLines((prev) => prev.map((x, i) => (i === index ? l : x)));
  }

  function deleteLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (headerError) {
      Swal.fire("Validación", headerError, "warning");
      return;
    }
    if (!lines.length) {
      Swal.fire("Validación", "Debe agregar al menos una línea.", "warning");
      return;
    }

    const payload: StockTransferCreatePayload = {
      transferDate: toISODateAtMidnight(transferDate),
      fromWarehouseId: Number(fromWarehouseId),
      toWarehouseId: Number(toWarehouseId),
      createdBy: "WEB",
      createdAt: new Date().toISOString(),
      lines: lines.map((x) => ({
        ...x,
        fromWarehouseId: Number(fromWarehouseId),
        toWarehouseId: Number(toWarehouseId),
      })),
    };

    await createTransfer(payload);
  }

  return {
    loading,
    products,
    warehouses,

    transferDate,
    setTransferDate,

    fromWarehouseId,
    setFromWarehouseId,

    toWarehouseId,
    setToWarehouseId,

    lines,
    addLine,
    updateLine,
    deleteLine,

    headerError,

    reloadLookups,
    save,

    // loaders para el modal
    loadBatches: getBatchOptions,
    loadSerials: getSerialOptions,
  };
}
