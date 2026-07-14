"use client";

import Swal from "sweetalert2";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Hash, Layers, Barcode } from "lucide-react";

import type { ProductMini, ReceiptDraft, ReceiptLineDraft } from "../types";
import { clamp, splitSerials, unitNetCost, round2 } from "../utils";

const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmtPY.format(Number(n || 0));

function getProd(products: Map<number, ProductMini>, id: number) {
  return products.get(id);
}

export function LinesEditor({
  draft,
  productMap,
  onLineChange,
}: {
  draft: ReceiptDraft;
  productMap: Map<number, ProductMini>;
  onLineChange: (poLineId: number, patch: Partial<ReceiptLineDraft>) => void;
}) {
  const pending = draft.pendingDoc;
  const lines = draft.lines ?? [];

  const taxRateByPoLineId = new Map<number, number>(
    (pending?.lines ?? []).map((l) => [l.id, Number(l.taxRate ?? 0)])
  );

  function warnIfZeroLines() {
    const used = lines.some((l) => Number(l.quantity) > 0);
    if (!used) Swal.fire("Atención", "Debés cargar al menos 1 línea con cantidad > 0.", "warning");
  }

  return (
    <Card className="border-slate-200 p-6 shadow-sm">
      <SectionHeader
        icon={<ClipboardList className="h-5 w-5 text-[#C5A05A]" />}
        title="Líneas a recepcionar"
        subtitle="Ajustá cantidades. Si es lote/serial, completá los campos."
        right={
          <button
            type="button"
            onClick={warnIfZeroLines}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Validar rápido
          </button>
        }
      />
      <Separator className="my-4" />

      {!pending ? (
        <div className="text-sm text-gray-500">Seleccioná una OC para cargar pendientes.</div>
      ) : (
        <div className="space-y-4">
          {lines.map((l) => {
            const p = getProd(productMap, l.productId);
            const isBatch = !!p?.isBatchManaged;
            const isSerial = !!p?.isSerialManaged;

            const qty = Number(l.quantity || 0);
            const unitPrice = Number(l.unitPrice || 0);
            const disc = clamp(Number(l.discountPercent || 0), 0, 100);

            const unitNet = unitNetCost(unitPrice, disc);
            const lineSub = round2(qty * unitNet);

            const rate = Number(taxRateByPoLineId.get(l.poLineId) ?? 0);
            const lineTax = round2(lineSub * (rate / 100));
            const lineTotal = round2(lineSub + lineTax);

            const serialCount = isSerial ? splitSerials(l.serialNumbers).length : 0;
            const serialOk = !isSerial || (Number.isInteger(qty) && serialCount === qty);

            return (
              <div key={l.poLineId} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">{l.productName}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Pendiente: <b>{money(l.pendingQty)}</b>
                      {isBatch && (
                        <Badge className="ml-2 bg-slate-100 text-slate-700 border border-slate-200" variant="secondary">
                          <Layers className="h-3 w-3 mr-1" /> Lote
                        </Badge>
                      )}
                      {isSerial && (
                        <Badge className="ml-2 bg-slate-100 text-slate-700 border border-slate-200" variant="secondary">
                          <Barcode className="h-3 w-3 mr-1" /> Serial
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total línea</div>
                    <div className="font-bold">{money(lineTotal)}</div>
                    <div className="text-[11px] text-gray-500">
                      Sub: {money(lineSub)} · IVA: {money(lineTax)}
                    </div>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Cantidad */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Cantidad
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      max={l.pendingQty}
                      value={l.quantity}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onLineChange(l.poLineId, { quantity: Number.isFinite(v) ? v : 0 });
                      }}
                    />
                    {qty > l.pendingQty ? (
                      <div className="text-xs text-red-600 mt-1">Excede pendiente.</div>
                    ) : null}
                  </div>

                  {/* Precio sin IVA */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Precio s/IVA</label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={l.unitPrice}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onLineChange(l.poLineId, { unitPrice: Number.isFinite(v) ? v : 0 });
                      }}
                    />
                    {rate > 0 && <div className="text-[11px] text-gray-500 mt-1">IVA {rate}%</div>}
                  </div>

                  {/* Precio con IVA */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Precio c/IVA</label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={rate > 0 ? round2(unitPrice * (1 + rate / 100)) : unitPrice}
                      onChange={(e) => {
                        const withIva = Number(e.target.value);
                        if (!Number.isFinite(withIva)) return;
                        const sinIva = rate > 0 ? round2(withIva / (1 + rate / 100)) : withIva;
                        onLineChange(l.poLineId, { unitPrice: sinIva });
                      }}
                    />
                    {rate > 0 && <div className="text-[11px] text-gray-500 mt-1">÷ {(1 + rate / 100).toFixed(2)}</div>}
                  </div>

                  {/* Descuento */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">Desc. %</label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={l.discountPercent}
                      onChange={(e) => {
                        const v = clamp(Number(e.target.value), 0, 100);
                        onLineChange(l.poLineId, { discountPercent: Number.isFinite(v) ? v : 0 });
                      }}
                    />
                    <div className="text-[11px] text-gray-500 mt-1">Neto: {money(unitNet)}</div>
                  </div>

                  {/* Lote */}
                  {isBatch ? (
                    <div className="md:col-span-4">
                      <label className="text-xs font-semibold text-gray-700">Lote</label>
                      <Input
                        placeholder="Ej: LOT-0001"
                        value={l.batchNumber}
                        onChange={(e) => onLineChange(l.poLineId, { batchNumber: e.target.value })}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700">Vencimiento</label>
                          <Input
                            type="date"
                            value={l.expirationDate}
                            onChange={(e) => onLineChange(l.poLineId, { expirationDate: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Serial */}
                  {isSerial ? (
                    <div className="md:col-span-12">
                      <label className="text-xs font-semibold text-gray-700">Seriales (coma / salto de línea)</label>
                      <textarea
                        className="w-full min-h-[90px] rounded-md border border-slate-200 bg-white p-2 text-sm"
                        value={l.serialNumbers}
                        onChange={(e) => onLineChange(l.poLineId, { serialNumbers: e.target.value })}
                        placeholder="SN0001, SN0002, ..."
                      />
                      <div className={`text-xs mt-1 ${serialOk ? "text-gray-500" : "text-red-600"}`}>
                        Seriales: <b>{serialCount}</b> · Cantidad: <b>{qty}</b>{" "}
                        {!serialOk ? " (No coincide)" : ""}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
