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
  HandCoins,
  Ban,
} from "lucide-react";

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI DataGrid (solo cuotas)
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n ?? 0));
const toDate = (s: any) => (s ? String(s).slice(0, 10) : "");

type APInvoice = {
  id: number;
  purchaseReceiptId: number;
  supplierId: number;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  total: number;
  balance: number;
  status?: string | null; // OPEN|PARTIAL|PAID|CANCELLED
  cancelledAt?: string | null;
  cancelReason?: string | null;
};

type InstallmentRow = {
  id: number;
  apInvoiceId: number;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string; // OPEN|PAID|CANCELLED
};

type PaymentRow = {
  id: number;
  apInvoiceId: number;

  paymentDate: string;
  amount: number;

  method: string;
  reference?: string | null;
  notes?: string | null;

  isCancelled: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;

  // si algún día linkeás al PaymentMade:
  paymentMadeId?: number | null;

  targetInstallmentId?: number | null;
  applyExcessToNext?: boolean;
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

export default function APInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [loading, setLoading] = useState(false);

  const [inv, setInv] = useState<APInvoice | null>(null);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, ins, p] = await Promise.all([
        api.get(`/apinvoices/${id}`),
        api.get(`/apinvoiceinstallments/by-invoice/${id}`),
        api.get(`/apinvoicepayments/by-invoice/${id}`),
      ]);

      setInv(a.data as APInvoice);
      setInstallments((ins.data ?? []) as InstallmentRow[]);
      setPayments((p.data ?? []) as PaymentRow[]);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar CxP"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async () => {
    const { value: reason } = await Swal.fire({
      title: "Anular Factura Proveedor",
      text: "Esta acción no reversa pagos existentes. ¿Ingresá el motivo de anulación:",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      icon: "warning",
    });
    if (reason === undefined) return;
    try {
      await api.post(`/apinvoices/${id}/cancel`, { reason: reason || "Anulado manualmente." });
      Swal.fire("Anulada", "La factura fue anulada.", "success");
      await loadAll();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo anular"), "error");
    }
  };

  const st = normStatus(inv?.status);
  const total = Number(inv?.total ?? 0);
  const balance = Number(inv?.balance ?? 0);
  const paidAmount = Math.max(0, total - balance);

  const paymentsOk = payments.filter((p) => !p.isCancelled).length;
  const paymentsCancelled = payments.filter((p) => p.isCancelled).length;

  const hasInstallments = installments.length > 0;

  const openInstallments = useMemo(() => {
    return (installments ?? [])
      .slice()
      .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0))
      .filter((x) => normStatus(x.status) !== "PAID" && Number(x.balance ?? 0) > 0);
  }, [installments]);

  const openInstallmentsCount = openInstallments.length;

  // ===== columns cuotas =====
  const installmentCols: GridColDef<InstallmentRow>[] = [
    { field: "installmentNo", headerName: "Cuota", width: 90 },
    { field: "dueDate", headerName: "Vence", width: 140, valueGetter: (_v, r) => toDate(r.dueDate) },
    {
      field: "amount",
      headerName: "Monto",
      width: 140,
      headerAlign: "right",
      align: "right",
      valueFormatter: (v) => money(v ?? 0),
    },
    {
      field: "paidAmount",
      headerName: "Pagado",
      width: 140,
      headerAlign: "right",
      align: "right",
      valueFormatter: (v) => money(v ?? 0),
    },
    {
      field: "balance",
      headerName: "Saldo",
      width: 140,
      headerAlign: "right",
      align: "right",
      valueFormatter: (v) => money(v ?? 0),
    },
    {
      field: "status",
      headerName: "Estado",
      width: 140,
      headerAlign: "center",
      align: "center",
      valueGetter: (_v, r) => normStatus(r.status),
      renderCell: (p) => {
        const s = normStatus(String(p.value ?? "OPEN"));
        const cls =
          s === "PAID" ? "bg-green-100 text-green-700" : s === "CANCELLED" ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-700";
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>
            {s}
          </span>
        );
      },
    },
  ];

  return (
    <PageShell
      icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
      title="Detalle CxP"
      subtitle={inv ? `${inv.supplierName} — Factura ${inv.invoiceNumber}` : "Cargando..."}
      chips={
        <>
          <Chip tone={st === "PAID" ? "ok" : st === "CANCELLED" ? "warn" : st === "PARTIAL" ? "info" : "neutral"}>
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
          <Chip tone="info">Pagos: {paymentsOk}</Chip>
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
            onClick={() => router.push("/ap-invoices")}
            disabled={loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Link href="/payments/made">
            <Button variant="outline" className="bg-white">
              <List className="mr-2 h-4 w-4" /> Pagos realizados
            </Button>
          </Link>

          {st !== "CANCELLED" && (
            <Button
              variant="outline"
              className="bg-white border-red-200 text-red-700 hover:bg-red-50"
              onClick={handleCancel}
              disabled={loading}
            >
              <Ban className="mr-2 h-4 w-4" /> Anular
            </Button>
          )}

          <Link href="/payments/made/new">
            <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow">
              <HandCoins className="mr-2 h-4 w-4" /> Nuevo pago
            </Button>
          </Link>
        </>
      }
    >
      {/* RESUMEN */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ReceiptText className="h-5 w-5 text-purple-600" />}
          title="Resumen"
          subtitle="Datos del documento, vencimiento, total y saldo. (Solo lectura)"
        />

        <Separator className="my-4" />

        {!inv ? (
          <div className="text-gray-600">Cargando...</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Factura</div>
                <div className="text-xl font-semibold flex items-center gap-2">
                  {inv.invoiceNumber}
                  <StatusBadge status={inv.status ?? "OPEN"} />
                </div>
                <div className="text-sm text-gray-700">
                  Proveedor: <b>{inv.supplierName}</b> (ID: {inv.supplierId}) · Recepción:{" "}
                  <b>#{inv.purchaseReceiptId}</b>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Fecha</div>
                  <div className="font-semibold">{toDate(inv.invoiceDate)}</div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Venc.</div>
                  <div className="font-semibold">{inv.dueDate ? toDate(inv.dueDate) : "-"}</div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="font-semibold">{money(inv.total)}</div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Saldo</div>
                  <div className="font-semibold">{money(inv.balance)}</div>
                </div>
              </div>
            </div>

            {st === "CANCELLED" && (
              <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
                <div>
                  <b>Cancelada:</b> {toDate(inv.cancelledAt)}{" "}
                  {inv.cancelReason ? `— ${inv.cancelReason}` : ""}
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
          subtitle={installments.length ? `${installments.length} cuota(s) generadas` : "Sin cuotas"}
          right={<div className="text-sm text-gray-600">{installments.length ? `Pendientes: ${openInstallmentsCount}` : ""}</div>}
        />

        <Separator className="my-4" />

        {!installments.length ? (
          <div className="text-gray-500">Esta CxP no tiene cuotas generadas.</div>
        ) : (
          <div className="rounded-xl border bg-white p-2">
            <ThemeProvider theme={muiTheme}>
              <div style={{ height: 420, width: "100%" }}>
                <DataGrid
                  rows={installments}
                  columns={installmentCols}
                  getRowId={(r: InstallmentRow): GridRowId => r.id}
                  loading={loading}
                  pageSizeOptions={[10, 25, 50, 100]}
                  initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                  disableRowSelectionOnClick
                />
              </div>
            </ThemeProvider>
          </div>
        )}
      </Card>

      {/* PAGOS (solo lectura) */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<CreditCard className="h-5 w-5 text-purple-600" />}
          title="Pagos aplicados"
          subtitle={payments.length ? `${payments.length} registro(s)` : "Sin pagos"}
          right={
            <Link href="/payments/made">
              <Button variant="outline" className="bg-white">
                <List className="mr-2 h-4 w-4" /> Ver pagos
              </Button>
            </Link>
          }
        />

        <Separator className="my-4" />

        {!payments.length ? (
          <div className="text-gray-500">Todavía no hay pagos aplicados.</div>
        ) : (
          <div className="rounded-xl border bg-white p-2 overflow-auto">
            <table className="min-w-[1080px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-3 border-b">Fecha</th>
                  <th className="p-3 border-b">Método</th>
                  <th className="p-3 border-b">Ref.</th>
                  <th className="p-3 border-b">Aplicación</th>
                  <th className="p-3 border-b text-right">Monto</th>
                  <th className="p-3 border-b">Estado</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const cancelled = !!p.isCancelled;
                  const app =
                    p.targetInstallmentId
                      ? `Cuota ${p.targetInstallmentId} · ${p.applyExcessToNext ? "Excedente → próximas" : "Sin excedente"}`
                      : "Auto (FIFO)";

                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{toDate(p.paymentDate)}</td>
                      <td className="p-3 border-b">{p.method}</td>
                      <td className="p-3 border-b">
                        <div>{p.reference ?? "—"}</div>
                        {!!p.notes && <div className="text-[11px] text-gray-500 mt-1">{p.notes}</div>}
                      </td>

                      <td className="p-3 border-b">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                          {app}
                        </span>
                      </td>

                      <td className="p-3 border-b text-right">{money(p.amount)}</td>

                      <td className="p-3 border-b">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            cancelled ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"
                          }`}
                        >
                          {cancelled ? "CANCELLED" : "OK"}
                        </span>

                        {cancelled && (
                          <div className="text-[11px] text-gray-500 mt-1">
                            {toDate(p.cancelledAt)} {p.cancelReason ? `— ${p.cancelReason}` : ""}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 text-[12px] text-gray-500">
              Nota: este detalle es <b>solo lectura</b>. Los pagos se registran desde <b>Pagos realizados</b>.
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  );
}