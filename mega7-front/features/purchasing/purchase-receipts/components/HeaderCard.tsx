"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FileText } from "lucide-react";
import type { PurchaseOrderOpen, ReceiptDraft } from "../types";

export function HeaderCard({
  openPOs,
  draft,
  onSelectPO,
  onChange,
}: {
  openPOs: PurchaseOrderOpen[];
  draft: ReceiptDraft;
  onSelectPO: (id: number) => void;
  onChange: (patch: Partial<ReceiptDraft>) => void;
}) {
  return (
    <Card className="border-slate-200 p-4 shadow-sm">
      <SectionHeader
        icon={<FileText className="h-5 w-5 text-[#C5A05A]" />}
        title="Cabecera"
        subtitle="Elegí la OC y la fecha de recepción."
      />
      <Separator className="my-3" />

      <div className="grid grid-cols-12 gap-3">
        {/* OC */}
        <div className="col-span-12 lg:col-span-6">
          <label className="text-xs font-semibold text-gray-700">
            Orden de Compra (OPEN)
          </label>
          <Select
            value={draft.purchaseOrderId ? String(draft.purchaseOrderId) : ""}
            onValueChange={(v) => onSelectPO(Number(v))}
          >
            <SelectTrigger className="bg-white h-9">
              <SelectValue placeholder="Seleccione OC abierta" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {openPOs.map((po) => (
                <SelectItem key={po.id} value={String(po.id)}>
                  {po.docNumber} — {po.supplierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fecha */}
        <div className="col-span-6 lg:col-span-3">
          <label className="text-xs font-semibold text-gray-700">
            Fecha Recepción
          </label>
          <Input
            className="h-9"
            type="date"
            value={draft.receiptDate}
            onChange={(e) => onChange({ receiptDate: e.target.value })}
          />
        </div>

        {/* Depósito */}
        <div className="col-span-6 lg:col-span-3">
          <label className="text-xs font-semibold text-gray-700">Depósito</label>
          <Input
            className="h-9"
            value={
              draft.pendingDoc?.warehouseName ??
              String(draft.pendingDoc?.warehouseId ?? "")
            }
            disabled
          />
        </div>

        {/* Comentarios */}
        <div className="col-span-12">
          <label className="text-xs font-semibold text-gray-700">Comentarios</label>
          <Input
            className="h-9"
            value={draft.comments}
            onChange={(e) => onChange({ comments: e.target.value })}
            placeholder="Observaciones..."
          />
        </div>
      </div>
    </Card>
  );
}
