"use client";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Save, ArrowLeft, RefreshCcw, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";

import { usePurchaseReceiptNew } from "@/features/purchasing/purchase-receipts/hooks";
import { HeaderCard } from "@/features/purchasing/purchase-receipts/components/HeaderCard";
import { DocumentsCard } from "@/features/purchasing/purchase-receipts/components/DocumentsCard";
import { LinesEditor } from "@/features/purchasing/purchase-receipts/components/LinesEditor";
import { ReceiptTotalsBar } from "@/features/purchasing/purchase-receipts/components/ReceiptTotalsBar";

export default function Page() {
  const router = useRouter();
  const pr = usePurchaseReceiptNew();

  async function onSave() {
    const res = await pr.save();
    if (!res.ok) return Swal.fire("Validación", res.error ?? "Error", "warning");
    Swal.fire("OK", "Remisión creada y stock actualizado.", "success");
    router.push("/remissions");
  }

  return (
    <PageShell
      icon={<PackageCheck className="h-6 w-6 text-[#C5A05A]" />}
      title="Nueva Remisión (con OC)"
      subtitle="Recepción de inventario vinculada a una Orden de Compra."
      right={
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => router.push("/remissions")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Button variant="outline" className="bg-white" onClick={pr.refreshLookups} disabled={pr.loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white" onClick={onSave} disabled={pr.loading}>
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </div>
      }
    >
      <HeaderCard openPOs={pr.openPOs} draft={pr.draft} onSelectPO={pr.selectPurchaseOrder} onChange={pr.setDraftPatch} />
      <DocumentsCard draft={pr.draft} onChange={pr.setDraftPatch} />
      <LinesEditor draft={pr.draft} productMap={pr.productMap} onLineChange={pr.setLine} />
      <ReceiptTotalsBar draft={pr.draft} />
    </PageShell>
  );
}
