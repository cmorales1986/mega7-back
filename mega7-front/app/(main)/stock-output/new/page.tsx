"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Swal from "sweetalert2";

import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { Plus, Pencil, Trash2, Save, RefreshCcw, PackageMinus, AlertTriangle } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageShell, Chip } from "@/components/ui/page-shell";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");

type Warehouse = { id: number; name: string; isActive?: boolean };

type Product = {
  id: number;
  code: string;
  name: string;
  isBatchManaged: boolean;
  isSerialManaged: boolean;
};

type StockOutputLine = {
  productId: number;
  quantity: number;
  batchNumber?: string | null;
  serialNumbers?: string | null;
  warehouseId: number;
};

type LineRow = StockOutputLine & {
  _rowId: string;
  productLabel: string;
  batchOrSerial: string;
};

type BatchPickDto = {
  id: number;
  productId: number;
  warehouseId: number;
  warehouseName: string;
  batchNumber: string;
  quantity: number;
  expirationDate?: string | null;
};

type SerialPickDto = {
  id: number;
  productId: number;
  warehouseId: number;
  warehouseName: string;
  serialNumber: string;
  isActive: boolean;
};

const splitSerials = (s: string | null | undefined) =>
  (s ?? "")
    .split(/[,;\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function toIsoDateAtStartLocal(yyyyMmDd: string) {
  // Evita desfase por timezone: crea fecha local 00:00 y pasa a ISO
  const [y, m, d] = yyyyMmDd.split("-").map((n) => Number(n));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
  return dt.toISOString();
}

export default function StockOutputNewPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [documentType, setDocumentType] = useState("REMISION");
  const [documentNumber, setDocumentNumber] = useState("");
  const [outputDate, setOutputDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<StockOutputLine[]>([]);

  const [openLineModal, setOpenLineModal] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  const [lineProductId, setLineProductId] = useState<number | "">("");
  const [lineQty, setLineQty] = useState<string>("1");

  const [lineBatchNumber, setLineBatchNumber] = useState<string>("");

  const [batchOptions, setBatchOptions] = useState<BatchPickDto[]>([]);
  const [serialOptions, setSerialOptions] = useState<SerialPickDto[]>([]);

  const [openSerialPicker, setOpenSerialPicker] = useState(false);
  const [serialSearch, setSerialSearch] = useState("");
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);

  const selectedProduct = useMemo(() => {
    if (!lineProductId) return null;
    return products.find((p) => p.id === Number(lineProductId)) ?? null;
  }, [lineProductId, products]);

  async function loadLookups() {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([api.get("/products"), api.get("/warehouses")]);
      setProducts(p.data ?? []);
      setWarehouses(w.data ?? []);
    } catch {
      Swal.fire("Error", "No se pudo cargar productos/depósitos", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    // Alertas suaves por tipo de documento
    const t = (documentType ?? "").toUpperCase().trim();
    if (t === "OTRO") {
      // no spamear, solo una sugerencia (podés quitar esto si molesta)
    }
  }, [documentType]);

  async function loadBatchOptions(productId: number, whId: number) {
    const res = await api.get(`/stock/batches/${productId}?warehouseId=${whId}&onlyAvailable=true`);
    setBatchOptions(res.data ?? []);
  }

  async function loadSerialOptions(productId: number, whId: number) {
    const res = await api.get(`/stock/serials/${productId}?warehouseId=${whId}`);
    setSerialOptions(res.data ?? []);
  }

  const resetLineModal = () => {
    setEditingLineIndex(null);
    setLineProductId("");
    setLineQty("1");

    setLineBatchNumber("");
    setBatchOptions([]);

    setSelectedSerials([]);
    setSerialOptions([]);
    setSerialSearch("");
    setOpenSerialPicker(false);
  };

  const openAddLine = () => {
    if (!warehouseId) {
      Swal.fire("Validación", "Seleccioná un depósito en la cabecera primero.", "warning");
      return;
    }
    resetLineModal();
    setOpenLineModal(true);
  };

  const openEditLine = async (idx: number) => {
    const l = lines[idx];
    setEditingLineIndex(idx);

    setLineProductId(l.productId);
    setLineQty(String(l.quantity ?? 0));
    setLineBatchNumber(l.batchNumber ?? "");

    const parsed = splitSerials(l.serialNumbers);
    setSelectedSerials(parsed);

    setBatchOptions([]);
    setSerialOptions([]);
    setSerialSearch("");
    setOpenSerialPicker(false);

    const p = products.find((x) => x.id === Number(l.productId));
    const whIdNum = Number(l.warehouseId);

    try {
      if (p?.isBatchManaged) await loadBatchOptions(Number(l.productId), whIdNum);
      if (p?.isSerialManaged) await loadSerialOptions(Number(l.productId), whIdNum);
    } catch {
      Swal.fire("Error", "No se pudo cargar lotes/seriales disponibles", "error");
    }

    setOpenLineModal(true);
  };

  const deleteLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateLine = () => {
    if (!lineProductId) return "Seleccione un producto.";
    const qty = Number(lineQty ?? 0);
    if (!qty || qty <= 0) return "Cantidad debe ser mayor a 0.";

    const p = products.find((x) => x.id === Number(lineProductId));
    if (!p) return "Producto inválido.";
    if (!warehouseId) return "Depósito inválido.";

    if (p.isBatchManaged) {
      if (!lineBatchNumber.trim()) return "El producto es loteable. Debe seleccionar un lote.";

      const b = batchOptions.find((x) => (x.batchNumber ?? "").trim() === lineBatchNumber.trim());
      if (!b) return "Lote inválido para este depósito.";
      if (qty > Number(b.quantity ?? 0))
        return `Stock insuficiente en el lote ${b.batchNumber}. Disponible: ${fmtPY.format(
          Number(b.quantity ?? 0)
        )}`;
    }

    if (p.isSerialManaged) {
      const unique = Array.from(new Set(selectedSerials));
      if (unique.length === 0) return "El producto es serializable. Debe seleccionar seriales.";
      if (unique.length !== qty)
        return `Cantidad de seriales (${unique.length}) debe coincidir con Quantity (${qty}).`;
    }

    return null;
  };

  const mergeOrReplaceLine = (prev: StockOutputLine[], newLine: StockOutputLine) => {
    // Si estamos editando, reemplaza directo
    if (editingLineIndex !== null) {
      return prev.map((x, i) => (i === editingLineIndex ? newLine : x));
    }

    // Si NO editamos:
    // - Para serial: NO merge (porque seriales)
    // - Para batch: merge si mismo product+warehouse+batch
    // - Para normal: merge si mismo product+warehouse
    const p = products.find((x) => x.id === newLine.productId);
    const isSerial = !!p?.isSerialManaged;
    if (isSerial) return [...prev, newLine];

    const key = (l: StockOutputLine) => {
      const base = `${l.productId}|${l.warehouseId}`;
      const b = (l.batchNumber ?? "").trim();
      return p?.isBatchManaged ? `${base}|${b}` : base;
    };

    const kNew = key(newLine);
    const idx = prev.findIndex((x) => key(x) === kNew);

    if (idx < 0) return [...prev, newLine];

    const merged: StockOutputLine = {
      ...prev[idx],
      quantity: Number(prev[idx].quantity ?? 0) + Number(newLine.quantity ?? 0),
    };

    const copy = prev.slice();
    copy[idx] = merged;
    return copy;
  };

  const saveLineFromModal = () => {
    const err = validateLine();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    const qtyNum = Number(lineQty ?? 0);
    const p = products.find((x) => x.id === Number(lineProductId))!;
    const whIdNum = Number(warehouseId);

    const serialStr = p.isSerialManaged ? Array.from(new Set(selectedSerials)).join(",") : null;

    const newLine: StockOutputLine = {
      productId: Number(lineProductId),
      quantity: qtyNum,
      batchNumber: p.isBatchManaged ? lineBatchNumber.trim() : null,
      serialNumbers: serialStr,
      warehouseId: whIdNum,
    };

    setLines((prev) => mergeOrReplaceLine(prev, newLine));

    setOpenLineModal(false);
    resetLineModal();
  };

  const rowsForGrid: LineRow[] = useMemo(() => {
    return lines.map((l, idx) => {
      const p = products.find((x) => x.id === l.productId);
      const label = p ? `${p.code} - ${p.name}` : `ID ${l.productId}`;

      let batchOrSerial = "";
      if (p?.isBatchManaged) batchOrSerial = `Lote: ${l.batchNumber ?? "-"}`;
      else if (p?.isSerialManaged) batchOrSerial = `Series: ${splitSerials(l.serialNumbers).length}`;

      return {
        ...l,
        _rowId: `${idx}-${l.productId}-${l.warehouseId}-${l.batchNumber ?? ""}`,
        productLabel: label,
        batchOrSerial,
      };
    });
  }, [lines, products]);

  const totals = useMemo(() => {
    const qty = lines.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
    return { lines: lines.length, qty };
  }, [lines]);

  const columns: GridColDef<LineRow>[] = [
    { field: "productLabel", headerName: "Producto", flex: 1, minWidth: 260 },
    {
      field: "quantity",
      headerName: "Cant.",
      width: 110,
      headerAlign: "center",
      align: "center",
      valueFormatter: (params: any) => fmtPY.format(Number(params.value ?? 0)),
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
        const idx = rowsForGrid.findIndex((r) => r._rowId === params.row._rowId);
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => openEditLine(idx)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-red-100 border-red-300 text-red-600"
              onClick={() => deleteLine(idx)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const validateOutput = (): string | null => {
    if (!documentType.trim()) return "DocumentType es obligatorio.";
    if (!documentNumber.trim()) return "DocumentNumber es obligatorio.";
    if (!outputDate) return "OutputDate es obligatorio.";
    if (!warehouseId) return "Debe seleccionar un depósito.";
    if (!lines || lines.length === 0) return "Debe agregar al menos una línea.";
    return null;
  };

  async function saveOutput() {
    const err = validateOutput();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    const docTypeUpper = documentType.trim().toUpperCase();
    if (docTypeUpper === "OTRO") {
      const r = await Swal.fire({
        title: "Confirmación",
        text: "Vas a registrar una salida con tipo OTRO. ¿Seguro?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, continuar",
        cancelButtonText: "Cancelar",
      });
      if (!r.isConfirmed) return;
    }

    const payload = {
      documentType: documentType.trim(),
      documentNumber: documentNumber.trim(),
      outputDate: toIsoDateAtStartLocal(outputDate),
      warehouseId: Number(warehouseId),
      notes: notes.trim() ? notes.trim() : null,
      socioNegocioId: null,
      lines: lines.map(({ productId, warehouseId, quantity, batchNumber, serialNumbers }) => ({
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        quantity: Number(quantity),
        batchNumber: batchNumber ?? null,
        serialNumbers: serialNumbers ?? null,
      })),
    };

    try {
      await api.post("/stockoutput", payload);
      Swal.fire("Ok", "Salida registrada correctamente.", "success");
      router.push("/stock-output");
    } catch (e: any) {
      const data = e?.response?.data;
      const msg =
        typeof data === "string"
          ? data
          : data?.title
          ? `${data.title}\n${JSON.stringify(data.errors ?? data, null, 2)}`
          : JSON.stringify(data ?? "Error", null, 2);

      Swal.fire("Error", msg, "error");
      console.error("POST /stockoutput error:", data);
    }
  }

  const canChangeWarehouse = lines.length === 0;

  return (
    <PageShell
      icon={<PackageMinus className="h-5 w-5" />}
      title="Salida de Productos"
      subtitle="Elegí depósito, documento y agregá líneas con lote/serial si aplica."
      chips={
        <>
          <Chip tone="neutral">Líneas: {totals.lines}</Chip>
          <Chip tone="neutral">Cant.: {fmtPY.format(totals.qty)}</Chip>
        </>
      }
      right={
        <div className="flex gap-2">
          <Button onClick={loadLookups} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button onClick={saveOutput} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow">
            <Save className="mr-2 h-4 w-4" /> Guardar salida
          </Button>
        </div>
      }
    >
      <div className="bg-white rounded-xl shadow border p-6 space-y-4">
        {!canChangeWarehouse && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <b>Depósito bloqueado:</b> ya tenés líneas. (Si querés cambiar depósito, borrá las líneas primero).
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <label className="text-sm font-medium">Depósito</label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={warehouseId}
              disabled={!canChangeWarehouse}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Seleccionar</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={outputDate} onChange={(e) => setOutputDate(e.target.value)} />
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Tipo documento</label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="REMISION">REMISION</option>
              <option value="FACTURA">FACTURA</option>
              <option value="OTRO">OTRO</option>
            </select>
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Nro documento</label>
            <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <label className="text-sm font-medium">Notas</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones..."
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Líneas</h2>

        <Button onClick={openAddLine} className="bg-blue-600 text-white">
          <Plus className="mr-2 h-4 w-4" /> Agregar línea
        </Button>
      </div>

      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow border p-4 flex-1 min-h-[320px] min-w-0 overflow-hidden">
          <DataGrid
            rows={rowsForGrid}
            columns={columns}
            loading={loading}
            getRowId={(r) => (r as any)._rowId}
            pageSizeOptions={[5, 10, 20]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
          />
        </div>
      </ThemeProvider>

      {/* MODAL LINEA */}
      <Dialog open={openLineModal} onOpenChange={setOpenLineModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingLineIndex === null ? "Agregar línea" : "Editar línea"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <label className="text-sm font-medium">Producto</label>
                <select
                  className="w-full h-10 rounded-md border px-3"
                  value={lineProductId}
                  onChange={async (e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setLineProductId(v);

                    setLineBatchNumber("");
                    setBatchOptions([]);

                    setSelectedSerials([]);
                    setSerialOptions([]);
                    setSerialSearch("");

                    if (!v || !warehouseId) return;

                    const p = products.find((x) => x.id === Number(v));
                    const whIdNum = Number(warehouseId);

                    try {
                      if (p?.isBatchManaged) await loadBatchOptions(Number(v), whIdNum);
                      if (p?.isSerialManaged) await loadSerialOptions(Number(v), whIdNum);
                    } catch {
                      Swal.fire("Error", "No se pudo cargar lotes/seriales disponibles", "error");
                    }
                  }}
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
                  value={lineQty}
                  onChange={(e) => {
                    const v = onlyDigits(e.target.value);
                    setLineQty(v);

                    const qty = Number(v || 0);
                    if (qty >= 0 && selectedSerials.length > qty) {
                      setSelectedSerials((prev) => prev.slice(0, qty));
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
                    value={lineBatchNumber}
                    onChange={(e) => setLineBatchNumber(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.batchNumber}>
                        {b.batchNumber} (Disp: {fmtPY.format(Number(b.quantity ?? 0))})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="text-sm font-medium">Disponible</label>
                  <div className="h-10 rounded-md border px-3 flex items-center bg-gray-50">
                    {(() => {
                      const b = batchOptions.find((x) => x.batchNumber === lineBatchNumber);
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
                        const qty = Number(lineQty || 0);
                        if (!qty || qty <= 0) {
                          Swal.fire("Validación", "Primero cargá la cantidad.", "warning");
                          return;
                        }
                        setOpenSerialPicker(true);
                      }}
                    >
                      Seleccionar seriales
                    </Button>

                    <div className="text-sm text-gray-600">
                      Seleccionados: <b>{selectedSerials.length}</b> / {Number(lineQty || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpenLineModal(false);
                  resetLineModal();
                }}
              >
                Cancelar
              </Button>
              <Button className="bg-[#2563eb] text-white" onClick={saveLineFromModal}>
                Guardar línea
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL SERIAL PICKER */}
      <Dialog open={openSerialPicker} onOpenChange={setOpenSerialPicker}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Seleccionar seriales</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Buscar serial..."
              value={serialSearch}
              onChange={(e) => setSerialSearch(e.target.value)}
            />

            <div className="h-[360px] overflow-auto border rounded-md p-3 space-y-2">
              {serialOptions
                .filter((s) =>
                  (s.serialNumber ?? "").toLowerCase().includes(serialSearch.toLowerCase().trim())
                )
                .map((s) => {
                  const sn = s.serialNumber;
                  const checked = selectedSerials.includes(sn);
                  const qty = Number(lineQty || 0);
                  const disableCheck = !checked && selectedSerials.length >= qty;

                  return (
                    <label key={s.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disableCheck}
                        onChange={(e) => {
                          const isOn = e.target.checked;
                          setSelectedSerials((prev) => {
                            if (isOn) {
                              if (prev.length >= qty) return prev;
                              return [...prev, sn];
                            }
                            return prev.filter((x) => x !== sn);
                          });
                        }}
                      />
                      <span className={disableCheck ? "text-gray-400" : ""}>{sn}</span>
                    </label>
                  );
                })}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Seleccionados: <b>{selectedSerials.length}</b> / {Number(lineQty || 0)}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedSerials([]);
                  }}
                >
                  Limpiar
                </Button>
                <Button
                  className="bg-[#2563eb] text-white"
                  onClick={() => {
                    setSelectedSerials((prev) => Array.from(new Set(prev)));
                    setOpenSerialPicker(false);
                  }}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
