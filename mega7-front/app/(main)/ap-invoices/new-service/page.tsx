"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  ArrowLeft,
  Save,
  ReceiptText,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";

const fmtPY = new Intl.NumberFormat("es-PY");
const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtMoneyInput = (s: string) => {
  const d = onlyDigits(s);
  if (!d) return "";
  return fmtPY.format(Number(d));
};
const parseMoneyInput = (s: string) => {
  const d = onlyDigits(s);
  return d ? Number(d) : 0;
};

// decimal qty helpers (allow 1.5 / 2,25 etc)
const parseQty = (s: string) => {
  const t = (s ?? "").trim().replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

// ✅ solo visual: mapear tipo interno -> etiqueta amigable
const prettyDocType = (t?: string | null) => {
  const v = String(t ?? "GOODS").toUpperCase().trim();
  return v === "SERVICE" ? "SERVICIO" : "MERCADERÍA";
};

type Supplier = {
  id: number;
  razonSocial: string;
  ruc?: string | null;
};

type LineUI = {
  id: string;
  description: string;
  qtyUI: string; // allow decimals
  unitUI: string; // money formatted digits
};

const toErrorMessage = (e: any, fallback: string) => {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.title === "string" && typeof data?.detail === "string")
    return `${data.title}\n${data.detail}`;
  if (typeof data?.title === "string") return data.title;

  if (data?.errors && typeof data.errors === "object") {
    try {
      const lines: string[] = [];
      for (const k of Object.keys(data.errors)) {
        const arr = (data.errors as any)[k];
        if (Array.isArray(arr)) lines.push(`${k}: ${arr.join(", ")}`);
        else lines.push(`${k}: ${String(arr)}`);
      }
      if (lines.length) return lines.join("\n");
    } catch {}
  }

  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
};

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function NewServiceAPInvoicePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>("");

  const [manualTotalUI, setManualTotalUI] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<LineUI[]>([]);

  // interno
  const sourceType: "SERVICE" | "GOODS" = "SERVICE";

  const supplierOptions = useMemo(() => {
    return suppliers
      .slice()
      .sort((a, b) => (a.razonSocial ?? "").localeCompare(b.razonSocial ?? ""));
  }, [suppliers]);

  const loadSuppliers = async () => {
    try {
      const res = await api.get(`/sociosnegocio/proveedores`);
      const data = Array.isArray(res.data) ? res.data : [];
      setSuppliers((data.filter(Boolean) as Supplier[]) ?? []);
    } catch (e: any) {
      Swal.fire(
        "Error",
        toErrorMessage(e, "No se pudo cargar proveedores"),
        "error"
      );
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const selectedSupplier = supplierId
    ? suppliers.find((s) => s.id === supplierId) ?? null
    : null;

  const hasLines = lines.length > 0;

  const totalFromLines = useMemo(() => {
    let acc = 0;
    for (const l of lines) {
      const qty = Math.max(0, parseQty(l.qtyUI));
      const unit = Math.max(0, parseMoneyInput(l.unitUI));
      acc += qty * unit;
    }
    return Math.round(acc * 100) / 100;
  }, [lines]);

  const totalFinal = useMemo(() => {
    if (hasLines) return totalFromLines;
    return parseMoneyInput(manualTotalUI);
  }, [hasLines, totalFromLines, manualTotalUI]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: uid(), description: "", qtyUI: "1", unitUI: "" },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((x) => x.id !== id));
  };

  const updateLine = (id: string, patch: Partial<LineUI>) => {
    setLines((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch } : x))
    );
  };

  const validate = (): string | null => {
    if (!supplierId) return "Seleccioná un proveedor.";
    if (!invoiceNumber.trim()) return "Ingresá el número de factura.";

    if (hasLines) {
      for (const l of lines) {
        if (!l.description.trim()) return "Cada línea debe tener descripción.";
        const qty = parseQty(l.qtyUI);
        const unit = parseMoneyInput(l.unitUI);
        if (qty <= 0) return "La cantidad debe ser mayor a 0 en todas las líneas.";
        if (unit <= 0)
          return "El precio unitario debe ser mayor a 0 en todas las líneas.";
      }
      if (totalFromLines <= 0) return "El total calculado debe ser mayor a 0.";
      return null;
    }

    const manual = parseMoneyInput(manualTotalUI);
    if (manual <= 0) return "El total debe ser mayor a 0.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      Swal.fire("Validación", err, "warning");
      return;
    }

    try {
      const payload = {
        supplierId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate: dueDate ? dueDate : null,
        total: hasLines ? 0 : parseMoneyInput(manualTotalUI),
        notes: notes?.trim() || null,
        lines: hasLines
          ? lines.map((l) => ({
              description: l.description.trim(),
              quantity: parseQty(l.qtyUI),
              unitPrice: parseMoneyInput(l.unitUI),
            }))
          : [],
      };

      const res = await api.post(`/apinvoices/service`, payload);

      const id = res.data?.id;
      await Swal.fire(
        "OK",
        `Factura de ${prettyDocType(sourceType)} creada. ID: ${id}`,
        "success"
      );
      window.location.href = "/ap-invoices";
    } catch (e: any) {
      Swal.fire(
        "Error",
        toErrorMessage(e, "No se pudo crear la factura de servicio"),
        "error"
      );
    }
  };

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title="Nueva factura (CxP)"
      subtitle="Registrá facturas de servicios/gastos (sin stock) con o sin líneas."
      chips={
        <>
          <Chip tone="info">Tipo: {prettyDocType(sourceType)}</Chip>
          <Chip tone="info">
            Proveedor: {selectedSupplier?.razonSocial ?? "—"}
          </Chip>
          <Chip tone="ok">Total: {fmtPY.format(totalFinal)}</Chip>
        </>
      }
      right={
        <>
          <Link href="/ap-invoices">
            <Button variant="outline" className="bg-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          </Link>

          <Button
            onClick={save}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
          >
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Sparkles className="h-5 w-5 text-purple-600" />}
          title="Datos de la factura"
          subtitle="No genera movimientos de stock. Se paga desde Pagos Realizados."
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Proveedor</Label>
            <Select
              value={supplierId ? String(supplierId) : ""}
              onValueChange={(v) => setSupplierId(Number(v))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Seleccionar proveedor…" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px] bg-white">
                {supplierOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.razonSocial} {s.ruc ? `· ${s.ruc}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Número Factura</Label>
            <Input
              className="bg-white"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: 001-001-0001234"
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              className="bg-white"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Vencimiento</Label>
            <Input
              type="date"
              className="bg-white"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Total manual solo si NO hay líneas */}
          {!hasLines && (
            <div className="space-y-2">
              <Label>Total (manual)</Label>
              <Input
                className="bg-white"
                inputMode="numeric"
                value={manualTotalUI}
                onChange={(e) => setManualTotalUI(fmtMoneyInput(e.target.value))}
                placeholder="0"
              />
              <div className="text-xs text-gray-600">
                Si no cargás líneas, este total será el importe de la factura.
              </div>
            </div>
          )}

          <div className="space-y-2 lg:col-span-3">
            <Label>Notas</Label>
            <Input
              className="bg-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: ANDE enero, internet oficina, combustible, etc."
            />
          </div>
        </div>

        <Separator className="my-6" />

        {/* LÍNEAS */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Líneas (opcional)
            </div>
            <div className="text-xs text-gray-600">
              Si agregás líneas, el total se calcula automáticamente.
            </div>
          </div>

          <Button variant="outline" className="bg-white" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" /> Agregar línea
          </Button>
        </div>

        <Separator className="my-4" />

        {lines.length === 0 ? (
          <div className="text-sm text-gray-600">
            No hay líneas. Podés cargar el total manual o agregar líneas para calcular el total.
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((l, idx) => {
              const qty = Math.max(0, parseQty(l.qtyUI));
              const unit = Math.max(0, parseMoneyInput(l.unitUI));
              const lineTotal = Math.round(qty * unit * 100) / 100;

              return (
                <div key={l.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      Línea #{idx + 1}
                    </div>

                    <Button
                      variant="outline"
                      className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => removeLine(l.id)}
                      title="Eliminar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-6 space-y-2">
                      <Label>Descripción</Label>
                      <Input
                        className="bg-white"
                        value={l.description}
                        onChange={(e) =>
                          updateLine(l.id, { description: e.target.value })
                        }
                        placeholder="Ej: Bidones de agua 20L / Internet / Combustible..."
                      />
                    </div>

                    <div className="lg:col-span-2 space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        className="bg-white"
                        inputMode="decimal"
                        value={l.qtyUI}
                        onChange={(e) => updateLine(l.id, { qtyUI: e.target.value })}
                        placeholder="1"
                      />
                    </div>

                    <div className="lg:col-span-2 space-y-2">
                      <Label>Precio unit.</Label>
                      <Input
                        className="bg-white"
                        inputMode="numeric"
                        value={l.unitUI}
                        onChange={(e) =>
                          updateLine(l.id, { unitUI: fmtMoneyInput(e.target.value) })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div className="lg:col-span-2 space-y-2">
                      <Label>Total línea</Label>
                      <Input
                        className="bg-white"
                        value={fmtPY.format(lineTotal)}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-end">
              <div className="rounded-xl border bg-white px-4 py-3">
                <div className="text-xs text-gray-600">Total calculado</div>
                <div className="text-lg font-semibold text-gray-900">
                  {fmtPY.format(totalFromLines)}
                </div>
              </div>
            </div>
          </div>
        )}

        <Separator className="my-6" />

        <div className="text-sm text-gray-600">
          Luego podés pagar esta factura desde <b>Pagos Realizados → Nuevo pago</b>, igual que cualquier CxP.
        </div>
      </Card>
    </PageShell>
  );
}
