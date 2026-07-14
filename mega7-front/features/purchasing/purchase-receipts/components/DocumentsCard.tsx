"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";
import { ClipboardList } from "lucide-react";
import type { ReceiptDraft } from "../types";

export function DocumentsCard({
  draft,
  onChange,
}: {
  draft: ReceiptDraft;
  onChange: (patch: Partial<ReceiptDraft>) => void;
}) {
  return (
    <Card className="border-slate-200 p-4 shadow-sm">
      <SectionHeader
        icon={<ClipboardList className="h-5 w-5 text-[#2563eb]" />}
        title="Documentos asociados"
        subtitle="Opcional: remisión y/o factura."
        right={
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#2563eb]"
              checked={draft.attachDocs}
              onChange={(e) => onChange({ attachDocs: e.target.checked })}
            />
            Asociar
          </label>
        }
      />

      <Separator className="my-3" />

      {!draft.attachDocs ? (
        <div className="text-sm text-gray-500">Desactivado.</div>
      ) : (
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-6 bg-slate-50 border rounded-xl p-3">
            <div className="text-sm font-semibold text-gray-800 mb-2">
              Remisión
            </div>

            <label className="text-xs font-semibold text-gray-600">
              N° Remisión
            </label>
            <Input
              className="bg-white h-9"
              value={draft.deliveryNoteNumber}
              onChange={(e) => onChange({ deliveryNoteNumber: e.target.value })}
              placeholder="Ej: REM-001245"
            />

            <label className="text-xs font-semibold text-gray-600 mt-2 block">
              Fecha (opcional)
            </label>
            <Input
              className="bg-white h-9"
              type="date"
              value={draft.deliveryNoteDate}
              onChange={(e) => onChange({ deliveryNoteDate: e.target.value })}
            />
          </div>

          <div className="col-span-12 lg:col-span-6 bg-slate-50 border rounded-xl p-3">
            <div className="text-sm font-semibold text-gray-800 mb-2">
              Factura
            </div>

            <label className="text-xs font-semibold text-gray-600">
              N° Factura
            </label>
            <Input
              className="bg-white h-9"
              value={draft.invoiceNumber}
              onChange={(e) => onChange({ invoiceNumber: e.target.value })}
              placeholder="Ej: 001-001-1234567"
            />

            <label className="text-xs font-semibold text-gray-600 mt-2 block">
              Fecha (opcional)
            </label>
            <Input
              className="bg-white h-9"
              type="date"
              value={draft.invoiceDate}
              onChange={(e) => onChange({ invoiceDate: e.target.value })}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
