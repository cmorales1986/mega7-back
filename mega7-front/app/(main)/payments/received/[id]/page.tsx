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

import { ArrowLeft, Printer, ReceiptText, ListChecks } from "lucide-react";
import { toErrorMsg } from "@/lib/api-error";

const fmtPY = new Intl.NumberFormat("es-PY");

type ReceiptLine = {
  id: number;
  arInvoiceId: number;
  appliedAmount: number;
  invoiceDocNumber?: string | null;
  invoiceFiscalNumber?: string | null;
};

type Receipt = {
  id: number;
  receiptDate: string;
  customerId: number;
  customerName: string;
  customerRuc?: string | null;

  paymentMethod: string;
  paymentReference?: string | null;

  totalReceived: number;
  notes?: string | null;

  fiscalFullNumber?: string | null;

  isDeposited: boolean;
  depositedAt?: string | null;
  bankMovementId?: number | null;

  lines: ReceiptLine[];
};

export default function PaymentReceivedDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);

  const openReceiptPdfById = async (rid: number) => {
    const pdfRes = await api.get(`/reports/sales-receipt/${rid}/pdf`, { responseType: "blob" });
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/arsalesreceipts/${id}`);
      setData(res.data ?? null);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el recibo"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const lines = useMemo(() => data?.lines ?? [], [data]);

  const title = data?.fiscalFullNumber ? `Recibo ${data.fiscalFullNumber}` : `Recibo #${id}`;

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title={title}
      subtitle={data ? `Cliente: ${data.customerName}` : loading ? "Cargando..." : "Sin datos"}
      chips={
        <>
          <Chip tone={data?.isDeposited ? "ok" : "warn"}>
            {data?.isDeposited ? "DEPOSITADO" : "PENDIENTE DEPÓSITO"}
          </Chip>
          <Chip tone="info">Líneas: {lines.length}</Chip>
          <Chip tone="ok">Total: {fmtPY.format(Number(data?.totalReceived ?? 0))}</Chip>
        </>
      }
      right={
        <>
          <Link href="/payments/received">
            <Button variant="outline" className="bg-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          </Link>

          <Button
            onClick={() => openReceiptPdfById(id)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            disabled={!data}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir PDF
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 p-6 shadow-sm lg:col-span-1">
          <SectionHeader
            icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
            title="Resumen"
            subtitle="Datos principales del cobro."
          />

          <Separator className="my-4" />

          {!data ? (
            <div className="text-sm text-gray-600">{loading ? "Cargando..." : "No encontrado."}</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha</span>
                <span className="font-medium">{String(data.receiptDate).slice(0, 10)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cliente</span>
                <span className="font-medium">{data.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">RUC</span>
                <span className="font-medium">{data.customerRuc ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Método</span>
                <span className="font-medium">{data.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Referencia</span>
                <span className="font-medium">{data.paymentReference ?? "-"}</span>
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between items-end">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-semibold">{fmtPY.format(Number(data.totalReceived ?? 0))}</span>
              </div>

              {data.notes ? (
                <>
                  <Separator className="my-3" />
                  <div>
                    <div className="text-gray-600">Notas</div>
                    <div className="font-medium">{data.notes}</div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </Card>

        <Card className="border-slate-200 p-6 shadow-sm lg:col-span-2">
          <SectionHeader
            icon={<ListChecks className="h-5 w-5 text-purple-600" />}
            title="Facturas aplicadas"
            subtitle="Detalle por factura del monto aplicado."
          />

          <Separator className="my-4" />

          {!data ? (
            <div className="text-sm text-gray-600">{loading ? "Cargando..." : "Sin líneas."}</div>
          ) : lines.length === 0 ? (
            <div className="text-sm text-gray-600">Sin líneas.</div>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
                  <div className="text-sm">
                    <div className="font-medium">
                      {l.invoiceFiscalNumber ?? l.invoiceDocNumber ?? `Factura #${l.arInvoiceId}`}
                    </div>
                    <div className="text-gray-600">ARInvoiceId: {l.arInvoiceId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Aplicado</div>
                    <div className="text-lg font-semibold">{fmtPY.format(Number(l.appliedAmount ?? 0))}</div>
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