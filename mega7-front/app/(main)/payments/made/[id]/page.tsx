"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import { ArrowLeft, Printer, HandCoins, ListChecks, Ban } from "lucide-react";
import { toErrorMsg } from "@/lib/api-error";

const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n ?? 0));
const norm = (s?: string | null) => String(s ?? "").toUpperCase().trim();

type ApplyLine = {
  id: number;
  apInvoiceId: number;
  amount: number;
  targetInstallmentId?: number | null;
  applyExcessToNext?: boolean;
};

type PaymentDoc = {
  id: number;
  paymentDate: string;
  supplierId?: number | null;
  payeeName: string;
  paymentType: string; // SUPPLIER | PAYROLL | IPS | TAX | OTHER
  method: string; // CASH | TRANSFER | CHECK | CARD | OTHER
  reference?: string | null;
  notes?: string | null;
  totalAmount: number;
  status: string; // POSTED | CANCELLED
  createdAt?: string | null;
  createdBy?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
};

type ApiResponse = {
  doc: PaymentDoc;
  applies: ApplyLine[];
};

export default function PaymentMadeDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const openPdfById = async (pid: number) => {
    const pdfRes = await api.get(`/reports/payment-made/${pid}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/paymentsmade/${id}`);
      setData(res.data ?? null);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el pago"), "error");
    } finally {
      setLoading(false);
    }
  };

  const cancelDoc = async () => {
    const ask = await Swal.fire({
      title: "Anular pago",
      input: "text",
      inputLabel: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
    });

    if (!ask.isConfirmed) return;

    try {
      setLoading(true);
      await api.post(`/paymentsmade/${id}/cancel`, { reason: ask.value || null });
      await Swal.fire("OK", "Pago anulado.", "success");
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo anular"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doc = data?.doc ?? null;
  const lines = useMemo(() => data?.applies ?? [], [data]);

  const isCancelled = norm(doc?.status) === "CANCELLED";
  const hasApplies = lines.length > 0;

  const title = doc
    ? hasApplies
      ? `Pago Realizado #${doc.id}`
      : `Pago (sin facturas) #${doc.id}`
    : `Pago #${id}`;

  return (
    <PageShell
      icon={<HandCoins className="h-5 w-5 text-purple-600" />}
      title={title}
      subtitle={
        doc
          ? `Beneficiario: ${doc.payeeName}`
          : loading
          ? "Cargando..."
          : "Sin datos"
      }
      chips={
        <>
          <Chip tone={isCancelled ? "warn" : "ok"}>
            {isCancelled ? "ANULADO" : "POSTED"}
          </Chip>
          <Chip tone="info">Líneas: {lines.length}</Chip>
          <Chip tone="ok">Total: {money(doc?.totalAmount ?? 0)}</Chip>
        </>
      }
      right={
        <>
          <Link href="/payments/made">
            <Button variant="outline" className="bg-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          </Link>

          <Button
            onClick={() => openPdfById(id)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            disabled={!doc}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir PDF
          </Button>

          <Button
            variant="destructive"
            onClick={cancelDoc}
            disabled={!doc || isCancelled || loading}
            title={isCancelled ? "Ya está anulado" : "Anular"}
          >
            <Ban className="mr-2 h-4 w-4" /> Anular
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* RESUMEN */}
        <Card className="border-slate-200 p-6 shadow-sm lg:col-span-1">
          <SectionHeader
            icon={<HandCoins className="h-5 w-5 text-purple-600" />}
            title="Resumen"
            subtitle="Datos principales del pago."
          />

          <Separator className="my-4" />

          {!doc ? (
            <div className="text-sm text-gray-600">
              {loading ? "Cargando..." : "No encontrado."}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha</span>
                <span className="font-medium">{String(doc.paymentDate).slice(0, 10)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Beneficiario</span>
                <span className="font-medium">{doc.payeeName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Tipo</span>
                <span className="font-medium">{doc.paymentType}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Método</span>
                <span className="font-medium">{doc.method}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Referencia</span>
                <span className="font-medium">{doc.reference ?? "-"}</span>
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between items-end">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-semibold">
                  {money(doc.totalAmount ?? 0)}
                </span>
              </div>

              {doc.notes ? (
                <>
                  <Separator className="my-3" />
                  <div>
                    <div className="text-gray-600">Notas</div>
                    <div className="font-medium">{doc.notes}</div>
                  </div>
                </>
              ) : null}

              {isCancelled ? (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-1">
                    <div className="text-gray-600">Anulación</div>
                    <div className="text-sm">
                      <div>
                        <span className="text-gray-600">Fecha:</span>{" "}
                        <span className="font-medium">
                          {doc.cancelledAt ? String(doc.cancelledAt).slice(0, 19) : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Motivo:</span>{" "}
                        <span className="font-medium">{doc.cancelReason ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </Card>

        {/* APLICACIONES */}
        <Card className="border-slate-200 p-6 shadow-sm lg:col-span-2">
          <SectionHeader
            icon={<ListChecks className="h-5 w-5 text-purple-600" />}
            title={hasApplies ? "Facturas aplicadas" : "Sin facturas"}
            subtitle={
              hasApplies
                ? "Detalle por factura del monto aplicado."
                : "Este pago no aplica a ninguna CxP (ej: sueldos/IPS/impuestos/otros)."
            }
          />

          <Separator className="my-4" />

          {!doc ? (
            <div className="text-sm text-gray-600">
              {loading ? "Cargando..." : "Sin datos."}
            </div>
          ) : !hasApplies ? (
            <div className="text-sm text-gray-600">
              No hay líneas de aplicación.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border bg-white p-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">Factura (APInvoiceId): {l.apInvoiceId}</div>
                    <div className="text-gray-600 text-xs">
                      {l.targetInstallmentId
                        ? `Cuota objetivo: ${l.targetInstallmentId} · ${
                            l.applyExcessToNext ? "Excedente → próximas" : "Sin excedente"
                          }`
                        : "Aplicación automática (FIFO)"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Aplicado</div>
                    <div className="text-lg font-semibold">{money(l.amount ?? 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}