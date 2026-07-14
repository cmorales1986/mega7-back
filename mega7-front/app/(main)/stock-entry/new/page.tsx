"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
} from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import {
  Plus,
  Pencil,
  Trash2,
  Save,
  RefreshCcw,
  ArrowLeft,
  PackagePlus,
  ClipboardList,
  DownloadCloud,
  AlertTriangle,
} from "lucide-react";

// ✅ componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// ===== helpers miles UI =====
const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtInput = (s: string) => {
  const d = onlyDigits(s);
  if (!d) return "";
  return fmtPY.format(Number(d));
};

// =================== TYPES ===================
type Warehouse = { id: number; code?: string; name: string; isActive?: boolean };

type Product = {
  id: number;
  code: string;
  name: string;
  isBatchManaged: boolean;
  isSerialManaged: boolean;
};

type StockEntryLine = {
  id?: number;
  stockEntryId?: number;

  productId: number;
  quantity: number;
  unitCost: number;
  taxRate: number;

  batchNumber?: string | null;
  expirationDate?: string | null; // ISO string para el front

  serialNumbers?: string | null;

  warehouseId: number;
};

type StockEntry = {
  id?: number;

  documentType: string;
  documentNumber: string;
  entryDate: string; // ISO

  warehouseId: number;

  supplierName?: string | null;
  notes?: string | null;

  entryMode: "ADD" | "SET";
  supplierId?: number | null;
  documentRef?: string | null;

  createdBy: string;
  createdAt?: string;

  lines: StockEntryLine[];
};

type LineRow = StockEntryLine & {
  _rowId: string;
  productLabel: string;
  total: number;
  batchOrSerial: string;
};

// ===== PurchaseReceipt minimal (para importar) =====
type PurchaseReceiptListItem = {
  id: number;
  docNumber: string;
  receiptDate?: string | null;
  supplierName?: string | null;
  warehouse?: { id: number; name: string } | null;
  total?: number | null;
};

type PurchaseReceiptDetail = {
  id: number;
  docNumber: string;
  receiptDate?: string | null;
  supplierName?: string | null;
  warehouseId?: number;
  lines: Array<{
    productId: number;
    productName?: string | null;
    quantity: number;
    unitPrice: number;
    batchNumber?: string | null;
    expirationDate?: string | null;
    serialNumbers?: string | null;
    taxId?: number | null;
  }>;
};

export default function StockEntryNewPage() {
  const router = useRouter();

  // ========= Lookups =========
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // ========= Import PR =========
  const [prLoading, setPrLoading] = useState(false);
  const [purchaseReceipts, setPurchaseReceipts] = useState<PurchaseReceiptListItem[]>([]);
  const [selectedPR, setSelectedPR] = useState<number | "">("");

  // ========= Header state =========
  const [entryMode, setEntryMode] = useState<"ADD" | "SET">("ADD");
  const [documentType, setDocumentType] = useState<string>("AJUSTE");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [warehouseId, setWarehouseId] = useState<number | "">("");

  const [supplierName, setSupplierName] = useState<string>("");
  const [documentRef, setDocumentRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // ========= Lines =========
  const [lines, setLines] = useState<StockEntryLine[]>([]);

  // ========= Line modal =========
  const [openLineModal, setOpenLineModal] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  const [lineProductId, setLineProductId] = useState<number | "">("");
  const [lineQty, setLineQty] = useState<string>("1");

  const [unitCostUI, setUnitCostUI] = useState<string>(fmtInput("0"));
  const [lineTaxRate, setLineTaxRate] = useState<string>("0");

  const [lineBatchNumber, setLineBatchNumber] = useState<string>("");
  const [lineExpDate, setLineExpDate] = useState<string>(""); // YYYY-MM-DD
  const [lineSerialNumbers, setLineSerialNumbers] = useState<string>("");

  const selectedProduct = useMemo(() => {
    if (!lineProductId) return null;
    return products.find((p) => p.id === Number(lineProductId)) ?? null;
  }, [lineProductId, products]);

  // ========= Load lookups =========
  async function loadLookups() {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([api.get("/products"), api.get("/warehouses")]);
      setProducts(p.data ?? []);
      setWarehouses(w.data ?? []);
    } catch {
      Swal.fire("Error", "No se pudo cargar productos/depósitos", "error");
    }
    setLoading(false);
  }

  // ========= Load purchase receipts list =========
  async function loadPurchaseReceipts() {
    setPrLoading(true);
    try {
      const res = await api.get("/purchasereceipts");
      const list = res.data ?? [];
      const mapped: PurchaseReceiptListItem[] = list.map((x: any) => ({
        id: x.id ?? x.Id,
        docNumber: x.docNumber ?? x.DocNumber ?? "",
        receiptDate: x.receiptDate ?? x.ReceiptDate ?? null,
        supplierName: x.supplierName ?? x.SupplierName ?? null,
        warehouse: x.warehouse ?? x.Warehouse ?? null,
        total: x.total ?? x.Total ?? null,
      }));
      setPurchaseReceipts(mapped);
    } catch {
      // no bloquea
      setPurchaseReceipts([]);
    }
    setPrLoading(false);
  }

  useEffect(() => {
    loadLookups();
    loadPurchaseReceipts();
  }, []);

  // ========= Line modal helpers =========
  const resetLineModal = () => {
    setEditingLineIndex(null);
    setLineProductId("");
    setLineQty("1");
    setUnitCostUI(fmtInput("0"));
    setLineTaxRate("0");
    setLineBatchNumber("");
    setLineExpDate("");
    setLineSerialNumbers("");
  };

  const openAddLine = () => {
    if (!warehouseId) {
      Swal.fire("Validación", "Seleccioná un depósito en la cabecera primero.", "warning");
      return;
    }
    resetLineModal();
    setOpenLineModal(true);
  };

  const openEditLine = (idx: number) => {
    const l = lines[idx];
    setEditingLineIndex(idx);

    setLineProductId(l.productId);
    setLineQty(String(l.quantity ?? 0));
    setUnitCostUI(fmtInput(String(l.unitCost ?? 0)));
    setLineTaxRate(String(l.taxRate ?? 0));

    setLineBatchNumber(l.batchNumber ?? "");
    setLineExpDate(l.expirationDate ? String(l.expirationDate).slice(0, 10) : "");
    setLineSerialNumbers(l.serialNumbers ?? "");

    setOpenLineModal(true);
  };

  const deleteLine = async (idx: number) => {
    const r = await Swal.fire({
      title: "Eliminar línea",
      text: "¿Querés eliminar esta línea?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      confirmButtonColor: "#d33",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateLine = () => {
    if (!lineProductId) return "Seleccione un producto.";
    const qty = Number(lineQty ?? 0);
    if (!qty || qty <= 0) return "Cantidad debe ser mayor a 0.";

    const p = products.find((x) => x.id === Number(lineProductId));
    if (!p) return "Producto inválido.";
    if (!warehouseId) return "Depósito inválido.";

    // costo no negativo
    const unitCostNum = Number(onlyDigits(unitCostUI) || 0);
    if (unitCostNum < 0) return "Costo inválido.";

    if (p.isBatchManaged) {
      if (!lineBatchNumber.trim()) return "El producto es loteable. Debe ingresar BatchNumber.";
    }

    if (p.isSerialManaged) {
      const list = lineSerialNumbers
        .split(/[,;\n\r]+/)
        .map((x) => x.trim())
        .filter(Boolean);

      const unique = Array.from(new Set(list));
      if (unique.length === 0) return "El producto es serializable. Debe ingresar SerialNumbers.";
      if (unique.length !== qty) {
        return `Cantidad de seriales (${unique.length}) debe coincidir con Quantity (${qty}).`;
      }
    }

    return null;
  };

  const saveLineFromModal = () => {
    const err = validateLine();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    const qtyNum = Number(lineQty ?? 0);
    const unitCostNum = Number(onlyDigits(unitCostUI) || 0);
    const taxRateNum = Number(lineTaxRate ?? 0);

    const p = products.find((x) => x.id === Number(lineProductId))!;
    const whIdNum = Number(warehouseId);

    const newLine: StockEntryLine = {
      productId: Number(lineProductId),
      quantity: qtyNum,
      unitCost: unitCostNum,
      taxRate: taxRateNum,
      batchNumber: p.isBatchManaged ? lineBatchNumber.trim() : null,
      expirationDate: p.isBatchManaged && lineExpDate ? lineExpDate : null,
      serialNumbers: p.isSerialManaged ? lineSerialNumbers : null,
      warehouseId: whIdNum,
    };

    setLines((prev) => {
      if (editingLineIndex === null) return [...prev, newLine];
      return prev.map((x, i) => (i === editingLineIndex ? newLine : x));
    });

    setOpenLineModal(false);
    resetLineModal();
  };

  // ========= Import PR flow =========
  const importFromPurchaseReceipt = async () => {
    if (!selectedPR) {
      Swal.fire("Validación", "Seleccioná una recepción primero.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Importar desde Recepción",
      html: `
        <div style="text-align:left">
          <p><b>Ojo:</b> lo normal es que el stock de compras se mueva por <b>Purchase Receipts</b>.</p>
          <p>Usá esta opción solo para: <b>migraciones</b>, <b>reprocesos</b> o casos especiales.</p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Importar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
    });

    if (!confirm.isConfirmed) return;

    setPrLoading(true);
    try {
      const res = await api.get(`/purchasereceipts/${selectedPR}`);
      const pr: PurchaseReceiptDetail = res.data;

      // setear cabecera sugerida
      const wh = (res.data?.warehouseId ?? pr.warehouseId) as number | undefined;
      if (wh) setWarehouseId(wh);

      setDocumentType("PURCHASE_RECEIPT");
      setDocumentNumber(pr.docNumber ?? "");
      setDocumentRef(`PR:${pr.docNumber}`);
      setSupplierName(pr.supplierName ?? "");

      // mapear líneas a stock entry lines (costo sugerido = unitPrice)
      const mappedLines: StockEntryLine[] = (pr.lines ?? []).map((l) => ({
        productId: Number(l.productId),
        quantity: Number(l.quantity ?? 0),
        unitCost: Number(l.unitPrice ?? 0),
        taxRate: 0,
        batchNumber: l.batchNumber ?? null,
        expirationDate: l.expirationDate ? String(l.expirationDate).slice(0, 10) : null,
        serialNumbers: l.serialNumbers ?? null,
        warehouseId: wh ?? Number(warehouseId || 0),
      }));

      // reemplaza líneas actuales
      setLines(mappedLines);

      Swal.fire("Ok", "Recepción importada. Revisá costos/lotes/series antes de guardar.", "success");
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo importar la recepción."), "error");
    }
    setPrLoading(false);
  };

  // ========= Grid rows =========
  const rowsForGrid: LineRow[] = useMemo(() => {
    return lines.map((l, idx) => {
      const p = products.find((x) => x.id === l.productId);
      const label = p ? `${p.code} - ${p.name}` : `ID ${l.productId}`;

      let batchOrSerial = "";
      if (p?.isBatchManaged) {
        batchOrSerial = `Lote: ${l.batchNumber ?? "-"}`;
      } else if (p?.isSerialManaged) {
        const list = (l.serialNumbers ?? "")
          .split(/[,;\n\r]+/)
          .map((x) => x.trim())
          .filter(Boolean);
        batchOrSerial = `Series: ${list.length}`;
      }

      return {
        ...l,
        _rowId: `${idx}-${l.productId}-${l.warehouseId}`,
        productLabel: label,
        total: Number(l.quantity ?? 0) * Number(l.unitCost ?? 0),
        batchOrSerial,
      };
    });
  }, [lines, products]);

  const totals = useMemo(() => {
    const linesCount = lines.length;
    const qtyTotal = lines.reduce((a, b) => a + Number(b.quantity ?? 0), 0);
    const total = lines.reduce(
      (a, b) => a + Number(b.quantity ?? 0) * Number(b.unitCost ?? 0),
      0
    );
    return { linesCount, qtyTotal, total };
  }, [lines]);

  // ========= Grid columns =========
  const columns: GridColDef<LineRow>[] = [
    { field: "productLabel", headerName: "Producto", flex: 1, minWidth: 260 },

    {
      field: "quantity",
      headerName: "Cant.",
      width: 95,
      headerAlign: "center",
      align: "center",
      valueFormatter: (params: any) => fmtPY.format(Number(params.value ?? 0)),
    },

    {
      field: "unitCost",
      headerName: "Costo Unit.",
      width: 140,
      headerAlign: "right",
      align: "right",
      valueFormatter: (params: any) => fmtPY.format(Number(params.value ?? 0)),
    },

    {
      field: "total",
      headerName: "Total",
      width: 150,
      headerAlign: "right",
      align: "right",
      valueFormatter: (params: any) => fmtPY.format(Number(params.value ?? 0)),
    },

    { field: "batchOrSerial", headerName: "Lote/Series", width: 170 },

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

  const validateEntry = (): string | null => {
    if (!documentType.trim()) return "DocumentType es obligatorio.";
    if (!documentNumber.trim()) return "DocumentNumber es obligatorio.";
    if (!entryDate) return "EntryDate es obligatorio.";
    if (!warehouseId) return "Debe seleccionar un depósito.";
    if (!lines || lines.length === 0) return "Debe agregar al menos una línea.";
    return null;
  };

  async function saveEntry() {
    const err = validateEntry();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    // ✅ confirmación fuerte para SET
    if (entryMode === "SET") {
      const r = await Swal.fire({
        title: "Confirmación SET",
        html: `
          <div style="text-align:left">
            <p><b>SET</b> reemplaza inventario del producto+depósito:</p>
            <ul>
              <li>borra stock general</li>
              <li>borra lotes</li>
              <li>borra seriales</li>
            </ul>
            <p>¿Seguro que querés continuar?</p>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, reemplazar",
        confirmButtonColor: "#d33",
        cancelButtonText: "Cancelar",
      });
      if (!r.isConfirmed) return;
    }

    const payload: StockEntry = {
      documentType: documentType.trim(),
      documentNumber: documentNumber.trim(),
      entryDate: new Date(entryDate + "T00:00:00").toISOString(),
      warehouseId: Number(warehouseId),

      supplierName: supplierName.trim() ? supplierName.trim() : null,
      notes: notes.trim() ? notes.trim() : null,

      entryMode,
      supplierId: null,
      documentRef: documentRef.trim() ? documentRef.trim() : null,

      createdBy: "WEB", // 🔴 cambiar por tu user real
      createdAt: new Date().toISOString(),

      lines: lines.map((l) => ({
        ...l,
        productId: Number(l.productId),
        warehouseId: Number(l.warehouseId),
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
        taxRate: Number(l.taxRate ?? 0),
        batchNumber: l.batchNumber ?? null,
        expirationDate: l.expirationDate ?? null,
        serialNumbers: l.serialNumbers ?? null,
      })),
    };

    try {
      await api.post("/stockentry", payload);
      Swal.fire("Ok", "Ingreso registrado correctamente.", "success");
      router.push("/stock-entry");
    } catch (e: any) {
      const msg = e?.response?.data;
      Swal.fire("Error", typeof msg === "string" ? msg : "No se pudo guardar.", "error");
    }
  }

  const modeLabel =
    entryMode === "SET"
      ? "SET - Ajuste por conteo (reemplaza)"
      : "ADD - Ingreso manual / migración";

  return (
    <PageShell
      icon={<PackagePlus className="h-5 w-5 text-slate-700" />}
      title="Nuevo ingreso de stock"
      subtitle="Este módulo es para ajustes/migración. Compras normales: Purchase Receipts."
      chips={
        <>
          <Chip tone="neutral">Modo: {entryMode}</Chip>
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

          <Button onClick={loadLookups} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={saveEntry}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
          >
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      {/* ALERTA DE USO */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" />
        <div className="text-sm text-amber-900">
          <div className="font-semibold">Recomendación</div>
          <div className="text-amber-800">
            Para compras y recepciones usá <b>Purchase Receipts</b>. Stock Entry es para{" "}
            <b>ajustes</b>, <b>saldo inicial</b> y casos especiales.
          </div>
        </div>
      </div>

      {/* CABECERA */}
      <div className="bg-white rounded-xl border shadow p-5 space-y-4">
        <SectionHeader
          icon={<ClipboardList className="h-5 w-5 text-slate-700" />}
          title="Cabecera"
          subtitle={`${modeLabel} • Seleccioná depósito antes de cargar líneas`}
        />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <label className="text-sm font-medium">Modo</label>
            <select
              className="w-full h-10 rounded-md border px-3 bg-white"
              value={entryMode}
              onChange={async (e) => {
                const next = (e.target.value as any) ?? "ADD";

                if (next === "SET" && lines.length > 0) {
                  const r = await Swal.fire({
                    title: "Cambiar a SET",
                    text: "Tenés líneas cargadas. SET reemplaza inventario y es delicado. ¿Continuar?",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí",
                    cancelButtonText: "Cancelar",
                  });
                  if (!r.isConfirmed) return;
                }

                setEntryMode(next);
                // si cambia a SET, sugerimos document type
                if (next === "SET") setDocumentType("AJUSTE_CONTEO");
              }}
            >
              <option value="ADD">ADD - Ingreso manual / migración</option>
              <option value="SET">SET - Ajuste por conteo (reemplaza)</option>
            </select>
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Depósito</label>
            <select
              className="w-full h-10 rounded-md border px-3 bg-white"
              value={warehouseId}
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
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>

          <div className="col-span-3">
            <label className="text-sm font-medium">Tipo documento</label>
            <select
              className="w-full h-10 rounded-md border px-3 bg-white"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="AJUSTE">AJUSTE</option>
              <option value="AJUSTE_CONTEO">AJUSTE_CONTEO</option>
              <option value="SALDO_INICIAL">SALDO_INICIAL</option>
              <option value="OTRO">OTRO</option>
              <option value="PURCHASE_RECEIPT">PURCHASE_RECEIPT</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <label className="text-sm font-medium">Nro documento</label>
            <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
          </div>

          <div className="col-span-4">
            <label className="text-sm font-medium">Proveedor (opcional)</label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>

          <div className="col-span-5">
            <label className="text-sm font-medium">Referencia (opcional)</label>
            <Input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <label className="text-sm font-medium">Notas</label>
            <Textarea
              rows={3}
              placeholder="Observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* IMPORTAR DESDE RECEPCIÓN (solo ADD) */}
      {entryMode === "ADD" && (
        <div className="bg-white rounded-xl border shadow p-5 space-y-4">
          <SectionHeader
            icon={<DownloadCloud className="h-5 w-5 text-slate-700" />}
            title="Importar desde Purchase Receipt (opcional)"
            subtitle="Solo para migración/reproceso. Compras normales NO van por acá."
          />

          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-9">
              <label className="text-sm font-medium">Recepción</label>
              <select
                className="w-full h-10 rounded-md border px-3 bg-white"
                value={selectedPR}
                onChange={(e) => setSelectedPR(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Seleccionar</option>
                {purchaseReceipts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.docNumber} • {x.supplierName ?? "—"} • {x.warehouse?.name ?? "—"}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                Si no aparece la recepción, refrescá o revisá permisos/endpoints.
              </div>
            </div>

            <div className="col-span-3 flex gap-2">
              <Button onClick={loadPurchaseReceipts} variant="outline" disabled={prLoading}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
              </Button>

              <Button
                onClick={importFromPurchaseReceipt}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={prLoading}
              >
                Importar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LÍNEAS */}
      <div className="bg-white rounded-xl border shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            icon={<ClipboardList className="h-5 w-5 text-slate-700" />}
            title="Líneas"
            subtitle="Agregá productos. Si es lote/serie, el modal lo exige automáticamente."
          />

          <Button onClick={openAddLine} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Agregar línea
          </Button>
        </div>

        <ThemeProvider theme={muiTheme}>
          <div className="min-h-[360px] w-full">
            <DataGrid
              rows={rowsForGrid}
              columns={columns}
              loading={loading || prLoading}
              getRowId={(r) => r._rowId}
              pageSizeOptions={[5, 10, 20]}
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
                  className="w-full h-10 rounded-md border px-3 bg-white"
                  value={lineProductId}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setLineProductId(v);
                    setLineBatchNumber("");
                    setLineExpDate("");
                    setLineSerialNumbers("");
                  }}
                >
                  <option value="">Seleccionar</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {selectedProduct.isBatchManaged && (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border text-slate-700">
                        Loteable
                      </span>
                    )}
                    {selectedProduct.isSerialManaged && (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border text-slate-700">
                        Serializable
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  inputMode="numeric"
                  value={lineQty}
                  onChange={(e) => setLineQty(onlyDigits(e.target.value))}
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">TaxRate</label>
                <Input
                  inputMode="decimal"
                  value={lineTaxRate}
                  onChange={(e) => setLineTaxRate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="text-sm font-medium">Costo Unitario</label>
                <Input
                  inputMode="numeric"
                  value={unitCostUI}
                  onChange={(e) => setUnitCostUI(fmtInput(e.target.value))}
                />
              </div>

              <div className="col-span-8">
                <div className="text-sm text-gray-600 mt-8">
                  Total línea:{" "}
                  <span className="font-semibold">
                    {fmtPY.format(Number(lineQty || 0) * Number(onlyDigits(unitCostUI) || 0))}
                  </span>
                </div>
              </div>
            </div>

            {selectedProduct?.isBatchManaged && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <label className="text-sm font-medium">BatchNumber</label>
                  <Input
                    value={lineBatchNumber}
                    onChange={(e) => setLineBatchNumber(e.target.value)}
                    placeholder="Ej: LOT-2025-001"
                  />
                </div>

                <div className="col-span-6">
                  <label className="text-sm font-medium">Vencimiento</label>
                  <Input type="date" value={lineExpDate} onChange={(e) => setLineExpDate(e.target.value)} />
                </div>
              </div>
            )}

            {selectedProduct?.isSerialManaged && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm font-medium">
                    SerialNumbers (separar por coma o salto de línea)
                  </label>
                  <Textarea
                    rows={4}
                    value={lineSerialNumbers}
                    onChange={(e) => setLineSerialNumbers(e.target.value)}
                    placeholder={"SN001\nSN002\nSN003"}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Debe coincidir con la cantidad. Si Quantity=3, deben venir 3 seriales únicos.
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setOpenLineModal(false)}>
                Cancelar
              </Button>
              <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow" onClick={saveLineFromModal}>
                Guardar línea
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
