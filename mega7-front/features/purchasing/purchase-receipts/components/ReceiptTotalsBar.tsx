"use client";

import { unitNetCost, round2 } from "../utils";
import type { ReceiptDraft } from "../types";

const fmtPY = new Intl.NumberFormat("es-PY");

function money(n: number) {
  const v = Number(n || 0);
  return fmtPY.format(Number.isFinite(v) ? v : 0);
}

export function ReceiptTotalsBar({ draft }: { draft: ReceiptDraft }) {
  const lines = draft.lines ?? [];
  const pending = draft.pendingDoc?.lines ?? [];

  const taxRateByPoLineId = new Map<number, number>(
    pending.map((l) => [l.id, Number(l.taxRate ?? 0)])
  );

  let sub = 0;
  let tax = 0;
  let totalQty = 0;

  for (const l of lines) {
    const qty = Number(l.quantity || 0);
    if (qty <= 0) continue;

    const unitNet = unitNetCost(Number(l.unitPrice || 0), Number(l.discountPercent || 0));
    const lineSub = round2(qty * unitNet);

    const rate = Number(taxRateByPoLineId.get(l.poLineId) ?? 0);
    const lineTax = round2(lineSub * (rate / 100));

    sub += lineSub;
    tax += lineTax;
    totalQty += qty;
  }

  const total = round2(sub + tax);
  const items = lines.filter((l) => Number(l.quantity) > 0).length;

  return (
    <div className="sticky bottom-0 z-20">
      <div className="bg-white/90 backdrop-blur border-t border-slate-200">
        <div className="px-4 py-3">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 md:col-span-4">
              <div className="text-xs text-gray-500">
                Items: <b className="text-gray-900">{items}</b> · Cantidad:{" "}
                <b className="text-gray-900">{money(totalQty)}</b>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                * Costo stock: <b>neto sin IVA</b> (desc aplicado). Lotes/seriales guardan costo unitario.
              </div>
            </div>

            <div className="col-span-6 md:col-span-3 md:text-right">
              <div className="text-xs text-gray-500">Subtotal (sin IVA)</div>
              <div className="font-semibold">{money(sub)}</div>
            </div>

            <div className="col-span-6 md:col-span-3 md:text-right">
              <div className="text-xs text-gray-500">Impuesto</div>
              <div className="font-semibold">{money(tax)}</div>
            </div>

            <div className="col-span-12 md:col-span-2 md:text-right">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-bold">{money(total)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
