"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Check, FileUp, Wallet } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
type SocioMini = { id: number; razonSocial: string; tipo: string };

type ParsedRow = {
  excelName: string;   // nombre tal como aparece en el Excel (col 0)
  description: string; // parte del producto (después del primer guion)
  installments: { dueDate: string; amount: number; isPaid: boolean }[];
  paidCount: number;
  pendingCount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
};

type MappingEntry = {
  excelName: string;       // nombre raíz del cliente en Excel (antes del guion)
  customerId: number | null;
};

type Warehouse = { id: number; name: string };

const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmtPY.format(n || 0);

// Convierte serial de Excel a fecha ISO
function xlSerialToDate(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return d.toISOString().slice(0, 10);
}

function isPaidValue(v: unknown): boolean {
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    return s === "PDO" || s === "ESTEBAN" || s.startsWith("PDO");
  }
  return false;
}

// Extrae nombre base del cliente (antes del primer guion significativo)
function extractClientName(full: string): string {
  const idx = full.indexOf("-");
  return idx > 0 ? full.slice(0, idx).trim() : full.trim();
}

function extractDescription(full: string): string {
  const idx = full.indexOf("-");
  return idx > 0 ? full.slice(idx + 1).trim() : "";
}

// ── Parser de la hoja ──────────────────────────────────────────────────
function parseSheet(sheet: XLSX.WorkSheet): ParsedRow[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  if (!data.length) return [];

  const headerRow = data[0] as unknown[];
  // Construir mapa col_index → fecha ISO
  const dateCols: Record<number, string> = {};
  for (let i = 1; i < headerRow.length; i++) {
    const v = headerRow[i];
    if (typeof v === "number" && v > 40000) {
      dateCols[i] = xlSerialToDate(v);
    }
  }

  const rows: ParsedRow[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r] as unknown[];
    const name = row[0];
    if (!name || typeof name !== "string" || !name.trim()) continue;
    if (name.trim().toUpperCase() === "NOMBRE CLIENTE") continue;
    if (name.trim().toUpperCase().startsWith("TOTAL")) continue;

    const installments: ParsedRow["installments"] = [];
    for (const [idxStr, dateStr] of Object.entries(dateCols)) {
      const idx = Number(idxStr);
      const v = row[idx];
      if (v === null || v === undefined) continue;

      const paid = isPaidValue(v);
      const numVal = typeof v === "number" ? v : 0;
      installments.push({ dueDate: dateStr, amount: numVal, isPaid: paid });
    }

    if (!installments.length) continue;

    // Para PDO sin monto: inferir el monto de cuotas con valor numérico
    const numericAmounts = installments.filter((i) => !i.isPaid && i.amount > 0).map((i) => i.amount);
    const inferredAmount = numericAmounts.length > 0
      ? numericAmounts[Math.floor(numericAmounts.length / 2)]  // mediana aproximada
      : 0;

    const withAmounts = installments.map((i) => ({
      ...i,
      amount: i.isPaid ? inferredAmount : i.amount,
    }));

    const paidCount = withAmounts.filter((i) => i.isPaid).length;
    const pendingCount = withAmounts.filter((i) => !i.isPaid).length;
    const paidAmount = withAmounts.filter((i) => i.isPaid).reduce((s, i) => s + i.amount, 0);
    const pendingAmount = withAmounts.filter((i) => !i.isPaid).reduce((s, i) => s + i.amount, 0);

    rows.push({
      excelName: name.trim(),
      description: extractDescription(name.trim()),
      installments: withAmounts,
      paidCount,
      pendingCount,
      totalAmount: paidAmount + pendingAmount,
      paidAmount,
      pendingAmount,
    });
  }

  return rows;
}

// ── Steps ──────────────────────────────────────────────────────────────
const STEPS = ["Cargar archivo", "Mapear clientes", "Confirmar e importar"];

// ── Page ───────────────────────────────────────────────────────────────
export default function ImportarCuoteroPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0: upload
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Step 1: mapping
  const [socios, setSocios] = useState<SocioMini[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  // mapa: excelName raíz → customerId
  const [mappings, setMappings] = useState<Record<string, number | null>>({});

  // Step 2: result
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ id: number; razonSocial: string; tipo: string }[]>("/sociosnegocio?tipo=CLIENTE"),
      api.get<Warehouse[]>("/warehouses"),
    ]).then(([sc, wh]) => {
      setSocios(sc.data ?? []);
      const whList = wh.data ?? [];
      setWarehouses(whList);
      if (whList.length) setWarehouseId(whList[0].id);
    }).catch(() => {});
  }, []);

  // ── File upload handler ─────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: "array", dense: true });

        // Buscar la hoja principal (primera que tenga "CUOTERO" en el nombre, o la primera)
        const sheetName =
          wb.SheetNames.find((n) => n.toUpperCase().includes("CUOTERO")) ??
          wb.SheetNames[0];

        const sheet = wb.Sheets[sheetName];
        const rows = parseSheet(sheet);

        if (!rows.length) {
          Swal.fire("Sin datos", "No se encontraron filas en la hoja seleccionada.", "warning");
          return;
        }

        setParsedRows(rows);

        // Inicializar mappings con nombre raíz como clave
        const init: Record<string, number | null> = {};
        for (const row of rows) {
          const key = extractClientName(row.excelName);
          if (!(key in init)) init[key] = null;
        }
        setMappings(init);
        setStep(1);
      } catch (err) {
        Swal.fire("Error", "No se pudo leer el archivo. Asegurate de que sea .xlsb o .xlsx.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Import handler ──────────────────────────────────────────────────
  const handleImport = async () => {
    if (!warehouseId) {
      Swal.fire("Falta depósito", "Seleccioná un depósito antes de importar.", "warning");
      return;
    }

    // Construir payload: una fila por cada parsedRow, usando el mapping del nombre raíz
    const rows = parsedRows.map((row) => {
      const key = extractClientName(row.excelName);
      const customerId = mappings[key] ?? null;
      return {
        customerId,
        excelName: row.excelName,
        description: row.description || row.excelName, // concepto (parte después del guion)
        installments: row.installments.map((i) => ({
          dueDate: i.dueDate + "T00:00:00Z",
          amount: i.amount,
          isPaid: i.isPaid,
        })),
      };
    }).filter((r) => r.customerId !== null);

    if (!rows.length) {
      Swal.fire("Sin mapeos", "No hay filas con cliente asignado. Mapeá al menos un cliente.", "warning");
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: "Confirmar importación",
      html: `Se importarán <b>${rows.length}</b> registros.<br/>Las filas sin cliente asignado serán omitidas.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Importar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;

    setLoading(true);
    try {
      const res = await api.post<{ imported: number; errors: string[] }>("/cuotero/import", {
        warehouseId,
        rows,
      });
      setImportResult(res.data);
      setStep(2);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo importar"), "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Unique client keys for mapping UI ──────────────────────────────
  const uniqueKeys = Object.keys(mappings);
  const mappedCount = uniqueKeys.filter((k) => mappings[k] !== null).length;
  const rowsWithMapping = parsedRows.filter((r) => mappings[extractClientName(r.excelName)] !== null).length;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            <Wallet className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Importar Cuotero desde Excel</h1>
            <p className="text-sm text-muted-foreground">
              Cargá el archivo .xlsb o .xlsx, mapeá los clientes y confirmá la importación.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-4 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border ${
                  i < step
                    ? "bg-purple-600 text-white border-purple-600"
                    : i === step
                    ? "bg-white border-purple-600 text-purple-600"
                    : "bg-white border-slate-300 text-slate-400"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? "font-medium text-slate-800" : "text-slate-400"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="text-slate-300 mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 0: Upload */}
      {step === 0 && (
        <Card className="border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <FileUp className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Seleccionar archivo</h2>
          </div>
          <Separator />

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Seleccioná el archivo <b>CUOTERO MEGA 7.xlsb</b> (o exportado como .xlsx desde Excel).
              SheetJS leerá el archivo directamente en el navegador.
            </p>

            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-500">
                {fileName ? (
                  <span className="text-purple-700 font-medium">{fileName}</span>
                ) : (
                  "Hacé clic o arrastrá el archivo aquí"
                )}
              </p>
              <p className="text-xs text-slate-400">Formatos: .xlsb · .xlsx · .xls</p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsb,.xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => router.push("/socios-negocio/clientes/cuotas")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 1: Mapping */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Warehouse selector */}
          <Card className="border-slate-200 p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label>Depósito</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={warehouseId ?? ""}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-muted-foreground">
                <b>{parsedRows.length}</b> filas detectadas · <b>{uniqueKeys.length}</b> clientes únicos
              </div>
              <div className="text-sm text-muted-foreground md:text-right">
                Mapeados: <b className="text-purple-700">{mappedCount}</b> / {uniqueKeys.length} clientes →
                <b className="text-purple-700 ml-1">{rowsWithMapping}</b> filas a importar
              </div>
            </div>
          </Card>

          {/* Mapping table */}
          <Card className="border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold mb-3">Mapear clientes de Excel → SocioNegocio</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Asociá cada nombre del Excel al cliente registrado en el sistema. Las filas sin asignación serán omitidas.
            </p>

            <div className="space-y-3">
              {uniqueKeys.map((key) => {
                const rowsForKey = parsedRows.filter((r) => extractClientName(r.excelName) === key);
                const isMapped = !!mappings[key];
                return (
                  <div
                    key={key}
                    className={`rounded-lg border bg-white p-4 space-y-3 ${
                      isMapped ? "border-purple-200" : "border-slate-200"
                    }`}
                  >
                    {/* Fila principal: nombre + dropdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                      <div>
                        <p className="text-sm font-semibold">{key}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rowsForKey.length} concepto(s) ·{" "}
                          {rowsForKey.reduce((s, r) => s + r.paidCount, 0)} PDO ·{" "}
                          {rowsForKey.reduce((s, r) => s + r.pendingCount, 0)} pendientes ·{" "}
                          <span className="font-medium text-slate-700">
                            {money(rowsForKey.reduce((s, r) => s + r.pendingAmount, 0))} Gs.
                          </span>
                        </p>
                      </div>
                      <select
                        className={`w-full rounded-lg border px-3 py-2 text-sm ${
                          isMapped ? "border-purple-400 bg-purple-50 text-purple-800" : "border-slate-300"
                        }`}
                        value={mappings[key] ?? ""}
                        onChange={(e) =>
                          setMappings((prev) => ({
                            ...prev,
                            [key]: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      >
                        <option value="">— Sin asignar (omitir) —</option>
                        {socios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.razonSocial}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Conceptos (productos) de ese cliente */}
                    <div className="ml-1 space-y-1 border-l-2 border-slate-100 pl-3">
                      {rowsForKey.map((r) => (
                        <div key={r.excelName} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-slate-600">
                            {r.description || r.excelName}
                          </span>
                          <span className="flex gap-3 shrink-0">
                            <span className="text-emerald-600">{r.paidCount} PDO</span>
                            <span className="text-amber-600">{r.pendingCount} pend.</span>
                            <span className="font-semibold text-slate-700">{money(r.pendingAmount)} Gs.</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setStep(0); setParsedRows([]); }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={mappedCount === 0}
              onClick={handleImport}
            >
              {loading ? "Importando..." : "Importar"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Result */}
      {step === 2 && importResult && (
        <Card className="border-slate-200 p-8 shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-purple-100 p-4">
              <Check className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold">Importación completada</h2>
          <p className="text-3xl font-bold text-purple-700">{importResult.imported}</p>
          <p className="text-muted-foreground">registros de cuotero importados correctamente</p>

          {importResult.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Advertencias ({importResult.errors.length}):</p>
              {importResult.errors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => router.push("/socios-negocio/clientes/cuotas")}
            >
              <Wallet className="mr-2 h-4 w-4" /> Ver Cuotero
            </Button>
            <Button variant="outline" onClick={() => { setStep(0); setParsedRows([]); setImportResult(null); setFileName(""); }}>
              Nueva importación
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
