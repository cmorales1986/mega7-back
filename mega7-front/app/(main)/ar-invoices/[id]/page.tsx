"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  RefreshCcw,
  ArrowLeft,
  ReceiptText,
  ListChecks,
  CreditCard,
  List,
  Printer,
} from "lucide-react";

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { toErrorMsg } from "@/lib/api-error";

const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n || 0));
const toDate = (s: any) => (s ? String(s).slice(0, 10) : "");

type ARInvoice = {
  id: number;
  salesOrderId: number | null;
  customerId: number;
  customerName: string;
  docNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  total: number;
  balance: number;
  status: string;

  isCancelled?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
};

type ARPayment = {
  id: number;
  arInvoiceId: number;
  paymentDate: string;
  amount: number;
  method: string;
  reference: string | null;
  notes?: string | null;
  isCancelled: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;

  // ✅ link a recibo (viene del API: ARSalesReceiptId)
  arSalesReceiptId?: number | null;
};

type ARInstallment = {
  id: number;
  arInvoiceId: number;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string; // OPEN/PAID
};

const normStatus = (s?: string | null) =>
  String(s ?? "OPEN").toUpperCase().trim() || "OPEN";

const StatusBadge = ({ status }: { status: string }) => {
  const st = normStatus(status);
  const cls =
    st === "PAID"
      ? "bg-green-600"
      : st === "PARTIAL"
      ? "bg-amber-500"
      : st === "CANCELLED"
      ? "bg-gray-600"
      : "bg-blue-600";
  return <span className={`px-3 py-1 rounded-md text-white ${cls}`}>{st}</span>;
};

export default function ARInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [loading, setLoading] = useState(false);

  const openPdf = async () => {
    try {
      const res = await api.get(`/reports/sales-invoice/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch {
      // silencioso — el usuario verá que no se abrió nada
    }
  };

  const [ar, setAr] = useState<ARInvoice | null>(null);
  const [payments, setPayments] = useState<ARPayment[]>([]);
  const [installments, setInstallments] = useState<ARInstallment[]>([]);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, p, ins] = await Promise.all([
        api.get(`/arinvoices/${id}`),
        api.get(`/arinvoicepayments/by-invoice/${id}`),
        api.get(`/arinvoices/${id}/installments`),
      ]);

      setAr(a.data);

      // ✅ normaliza si el backend devuelve PascalCase o camelCase
      const rawPayments = p.data ?? [];
      const normalizedPayments: ARPayment[] = (
        Array.isArray(rawPayments) ? rawPayments : []
      ).map((x: any) => ({
        ...x,
        arSalesReceiptId: x?.arSalesReceiptId ?? x?.ARSalesReceiptId ?? null,
        notes: x?.notes ?? x?.Notes ?? null,
      }));

      setPayments(normalizedPayments);
      setInstallments(ins.data ?? []);
    } catch (e: any) {
      Swal.fire(
        "Error",
        toErrorMsg(e, "No se pudo cargar detalle"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ✅ cuotas pendientes ordenadas (FIFO)
  const openInstallments = useMemo(() => {
    return (installments ?? [])
      .slice()
      .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0))
      .filter(
        (x) => normStatus(x.status) !== "PAID" && Number(x.balance ?? 0) > 0
      );
  }, [installments]);

  // ========= chips =========
  const st = normStatus(ar?.status);
  const total = Number(ar?.total ?? 0);
  const balance = Number(ar?.balance ?? 0);
  const paidAmount = Math.max(0, total - balance);

  const paymentsOk = payments.filter((p) => !p.isCancelled).length;
  const paymentsCancelled = payments.filter((p) => p.isCancelled).length;

  const hasInstallments = installments.length > 0;
  const openInstallmentsCount = openInstallments.length;

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title="Detalle CxC"
      subtitle={ar ? `${ar.customerName} — FV ${ar.docNumber}` : "Cargando..."}
      chips={
        <>
          <Chip
            tone={
              st === "PAID"
                ? "ok"
                : st === "CANCELLED"
                ? "warn"
                : st === "PARTIAL"
                ? "info"
                : "neutral"
            }
          >
            Estado: {st}
          </Chip>
          <Chip tone="info">Total: {money(total)}</Chip>
          <Chip tone={balance > 0 ? "warn" : "ok"}>Saldo: {money(balance)}</Chip>
          <Chip tone="ok">Pagado: {money(paidAmount)}</Chip>
          <Chip tone={hasInstallments ? "info" : "neutral"}>
            Cuotas: {hasInstallments ? installments.length : 0}
          </Chip>
          <Chip tone={openInstallmentsCount > 0 ? "warn" : "neutral"}>
            Pendientes: {openInstallmentsCount}
          </Chip>
          <Chip tone="info">Cobros: {paymentsOk}</Chip>
          <Chip tone={paymentsCancelled > 0 ? "warn" : "neutral"}>
            Anulados: {paymentsCancelled}
          </Chip>
        </>
      }
      right={
        <>
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => router.push("/ar-invoices")}
            disabled={loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Link href="/payments/received">
            <Button variant="outline" className="bg-white">
              <List className="mr-2 h-4 w-4" /> Cobros recibidos
            </Button>
          </Link>

          <Button
            onClick={openPdf}
            disabled={!ar}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir PDF
          </Button>
        </>
      }
    >
      {/* RESUMEN */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
          title="Resumen"
          subtitle="Datos del documento, vencimiento, total y saldo."
        />

        <Separator className="my-4" />

        {!ar ? (
          <div className="text-gray-600">Cargando...</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Factura</div>
                <div className="text-xl font-semibold flex items-center gap-2">
                  {ar.docNumber}
                  <StatusBadge status={ar.status ?? "OPEN"} />
                </div>
                <div className="text-sm text-gray-700">
                  Cliente: <b>{ar.customerName}</b> (ID: {ar.customerId})
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Fecha</div>
                  <div className="font-semibold">{toDate(ar.invoiceDate)}</div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Venc.</div>
                  <div className="font-semibold">{toDate(ar.dueDate)}</div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="font-semibold">{money(ar.total)}</div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Saldo</div>
                  <div className="font-semibold">{money(ar.balance)}</div>
                </div>
              </div>
            </div>

            {st === "CANCELLED" && (
              <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
                <div>
                  <b>Cancelada:</b> {toDate(ar.cancelledAt)}{" "}
                  {ar.cancelReason ? `— ${ar.cancelReason}` : ""}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* CUOTAS */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5 text-purple-600" />}
          title="Cuotas"
          subtitle={
            installments.length
              ? `${installments.length} cuota(s) generadas`
              : "Sin cuotas"
          }
          right={
            <div className="text-sm text-gray-600">
              {installments.length ? `Pendientes: ${openInstallmentsCount}` : ""}
            </div>
          }
        />

        <Separator className="my-4" />

        {!installments.length ? (
          <div className="text-gray-500">Esta CxC no tiene cuotas generadas.</div>
        ) : (
          <div className="rounded-xl border bg-white p-2 overflow-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-3 border-b">#</th>
                  <th className="p-3 border-b">Venc.</th>
                  <th className="p-3 border-b text-right">Importe</th>
                  <th className="p-3 border-b text-right">Pagado</th>
                  <th className="p-3 border-b text-right">Saldo</th>
                  <th className="p-3 border-b">Estado</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((x) => {
                  const paid = normStatus(x.status) === "PAID";
                  return (
                    <tr key={x.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{x.installmentNo}</td>
                      <td className="p-3 border-b">{toDate(x.dueDate)}</td>
                      <td className="p-3 border-b text-right">
                        {money(x.amount)}
                      </td>
                      <td className="p-3 border-b text-right">
                        {money(x.paidAmount)}
                      </td>
                      <td className="p-3 border-b text-right">
                        {money(x.balance)}
                      </td>
                      <td className="p-3 border-b">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            paid
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {paid ? "PAID" : "OPEN"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* COBROS (solo lectura + link a recibo) */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<CreditCard className="h-5 w-5 text-purple-600" />}
          title="Cobros aplicados"
          subtitle={
            payments.length ? `${payments.length} registro(s)` : "Sin cobros"
          }
          right={
            <Link href="/payments/received">
              <Button variant="outline" className="bg-white">
                <List className="mr-2 h-4 w-4" /> Ver cobros
              </Button>
            </Link>
          }
        />

        <Separator className="my-4" />

        {!payments.length ? (
          <div className="text-gray-500">Todavía no hay cobros aplicados.</div>
        ) : (
          <div className="rounded-xl border bg-white p-2 overflow-auto">
            <table className="min-w-[1080px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-3 border-b">Fecha</th>
                  <th className="p-3 border-b">Método</th>
                  <th className="p-3 border-b">Ref.</th>
                  <th className="p-3 border-b">Recibo</th>
                  <th className="p-3 border-b text-right">Monto</th>
                  <th className="p-3 border-b">Estado</th>
                  <th className="p-3 border-b text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const cancelled = !!p.isCancelled;
                  const receiptId = p.arSalesReceiptId ?? null;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{toDate(p.paymentDate)}</td>
                      <td className="p-3 border-b">{p.method}</td>
                      <td className="p-3 border-b">
                        <div>{p.reference ?? "—"}</div>
                        {!!p.notes && (
                          <div className="text-[11px] text-gray-500 mt-1">
                            {p.notes}
                          </div>
                        )}
                      </td>

                      <td className="p-3 border-b">
                        {receiptId ? (
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                            #{receiptId}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="p-3 border-b text-right">
                        {money(p.amount)}
                      </td>

                      <td className="p-3 border-b">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            cancelled
                              ? "bg-gray-100 text-gray-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {cancelled ? "CANCELLED" : "OK"}
                        </span>
                        {cancelled && (
                          <div className="text-[11px] text-gray-500 mt-1">
                            {toDate(p.cancelledAt)}{" "}
                            {p.cancelReason ? `— ${p.cancelReason}` : ""}
                          </div>
                        )}
                      </td>

                      <td className="p-3 border-b text-right">
                        {receiptId ? (
                          // ✅ si ya existe detalle: /payments/received/[id]
                          <Link href={`/payments/received/${receiptId}`}>
                            <Button variant="outline" className="bg-white">
                              Ver
                            </Button>
                          </Link>
                        ) : (
                          // fallback al listado
                          <Link href="/payments/received">
                            <Button variant="outline" className="bg-white">
                              Ver
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 text-[12px] text-gray-500">
              Nota: este detalle es <b>solo lectura</b>. Los cobros se registran
              desde <b>Cobros recibidos</b>.
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  );
}