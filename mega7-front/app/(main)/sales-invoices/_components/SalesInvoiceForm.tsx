"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  RefreshCcw,
  ReceiptText,
  ShoppingCart,
  CalendarDays,
  CreditCard,
  ListChecks,
} from "lucide-react";

// ✅ tus componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { toErrorMsg } from "@/lib/api-error";

const fmtPY = new Intl.NumberFormat("es-PY");

type SalesOrder = {
  id: number;
  docNumber: string;
  orderDate: string | null;
  customerId: number;
  customerName: string;
  warehouseId: number;
  status: string;
};

type SalesOrderLine = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  invoicedQuantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId?: number | null;

  isBatchManaged?: boolean;
  isSerialManaged?: boolean;
};

type LineDraft = {
  salesOrderLineId: number | "";
  productLabel: string;
  pendingQty: number;
  quantity: number;
  batchNumber?: string | null;
  serialNumbers?: string | null;
};

export default function SalesInvoiceForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // OV selector
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [salesOrderId, setSalesOrderId] = useState<number | "">("");

  // detalle OV
  const [orderInfo, setOrderInfo] = useState<SalesOrder | null>(null);
  const [linesFromOrder, setLinesFromOrder] = useState<SalesOrderLine[]>([]);

  // factura
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [comments, setComments] = useState<string>("");

  // líneas a facturar (parcial)
  const [lines, setLines] = useState<LineDraft[]>([]);

  const loadOrders = async () => {
    const res = await api.get("/SalesOrders");
    const all = (Array.isArray(res.data) ? res.data : []) as SalesOrder[];
    setOrders(all.filter((x) => (x.status ?? "").toUpperCase() === "OPEN"));
  };

  const loadOrder = async (id: number) => {
    const res = await api.get(`/SalesOrders/${id}`);
    const doc = res.data;

    setOrderInfo({
      id: doc.id,
      docNumber: doc.docNumber,
      orderDate: doc.orderDate ?? null,
      customerId: doc.customerId,
      customerName: doc.customerName,
      warehouseId: doc.warehouseId,
      status: doc.status,
    });

    const mapped: SalesOrderLine[] = (doc.lines ?? []).map((l: any) => ({
      id: l.id,
      productId: l.productId,
      productCode: l.productCode,
      productName: l.productName,
      quantity: Number(l.quantity ?? 0),
      invoicedQuantity: Number(l.invoicedQuantity ?? 0),
      unitPrice: Number(l.unitPrice ?? 0),
      discountPercent: Number(l.discountPercent ?? 0),
      taxId: l.taxId ?? null,
      isBatchManaged: Boolean(l.isBatchManaged),
      isSerialManaged: Boolean(l.isSerialManaged),
    }));

    setLinesFromOrder(mapped);

    // por defecto: cargar todo pendiente
    const pending = mapped
      .map((l) => ({
        l,
        pendingQty: Math.max(0, Number(l.quantity) - Number(l.invoicedQuantity)),
      }))
      .filter((x) => x.pendingQty > 0);

    setLines(
      pending.map((x) => ({
        salesOrderLineId: x.l.id,
        productLabel: `${x.l.productCode} - ${x.l.productName}`,
        pendingQty: x.pendingQty,
        quantity: x.pendingQty,
        batchNumber: null,
        serialNumbers: null,
      }))
    );
  };

  useEffect(() => {
    (async () => {
      try {
        await loadOrders();
      } catch (e: any) {
        Swal.fire("Error", toErrorMsg(e, "No se pudo cargar OV"), "error");
      }
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      await loadOrders();
      if (salesOrderId) await loadOrder(Number(salesOrderId));
    } finally {
      setLoading(false);
    }
  };

  const setLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addEmptyLine = () => {
    setLines((prev) => [
      ...prev,
      {
        salesOrderLineId: "",
        productLabel: "",
        pendingQty: 0,
        quantity: 1,
        batchNumber: null,
        serialNumbers: null,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => {
    // total estimado usando unitPrice/discount de la OV (sin impuestos exactos)
    let sub = 0;

    for (const x of lines) {
      if (!x.salesOrderLineId || Number(x.quantity) <= 0) continue;

      const soLine = linesFromOrder.find((l) => l.id === Number(x.salesOrderLineId));
      if (!soLine) continue;

      const discFactor = (100 - (soLine.discountPercent || 0)) / 100;
      sub += Number(x.quantity) * (soLine.unitPrice || 0) * discFactor;
    }

    sub = Math.round(sub * 100) / 100;
    return { sub };
  }, [lines, linesFromOrder]);

  const validate = (): string | null => {
    if (!salesOrderId) return "Seleccione una Orden de Venta.";
    if (!invoiceDate) return "Seleccione fecha.";

    const valid = lines.filter((l) => l.salesOrderLineId && Number(l.quantity) > 0);
    if (!valid.length) return "Debe haber al menos 1 línea con cantidad > 0.";

    for (const l of valid) {
      const soLine = linesFromOrder.find((x) => x.id === Number(l.salesOrderLineId));
      if (!soLine) return "Hay una línea inválida (no pertenece a la OV).";

      const pending = Math.max(0, Number(soLine.quantity) - Number(soLine.invoicedQuantity));
      if (Number(l.quantity) > pending)
        return `Cantidad excede pendiente en ${soLine.productName}. Pendiente: ${pending}`;

      if (soLine.isBatchManaged && !String(l.batchNumber ?? "").trim())
        return `El producto ${soLine.productName} requiere lote.`;

      if (soLine.isSerialManaged) {
        const sn = String(l.serialNumbers ?? "").trim();
        if (!sn) return `El producto ${soLine.productName} requiere seriales.`;

        const list = sn
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (list.length !== Math.trunc(Number(l.quantity)))
          return `Seriales no coinciden con cantidad en ${soLine.productName}. Cant: ${l.quantity}, Seriales: ${list.length}`;
      }
    }

    if (paymentType === "CREDIT" && (installmentsCount < 1 || installmentsCount > 60))
      return "Cuotas inválidas (1..60).";

    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    setLoading(true);
    try {
      const payload = {
        salesOrderId: Number(salesOrderId),
        invoiceDate: new Date(invoiceDate).toISOString(),
        paymentType,
        installmentsCount: paymentType === "CREDIT" ? Number(installmentsCount) : null,
        comments: comments?.trim() || null,
        lines: lines
          .filter((l) => l.salesOrderLineId && Number(l.quantity) > 0)
          .map((l) => ({
            salesOrderLineId: Number(l.salesOrderLineId),
            quantity: Number(l.quantity),
            batchNumber: l.batchNumber?.trim() || null,
            serialNumbers: l.serialNumbers?.trim() || null,
          })),
      };

      const res = await api.post("/salesinvoices", payload);
      const newId = res.data?.id ?? res.data?.Id ?? res.data;

      Swal.fire("OK", "Factura creada.", "success");
      router.push(`/sales-invoices/${Number(newId)}`);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo crear factura"), "error");
    } finally {
      setLoading(false);
    }
  };

  // chips
  const chips = useMemo(() => {
    const count = lines.length;
    const pendingLines = lines.filter((x) => Number(x.quantity) > 0).length;
    return { count, pendingLines };
  }, [lines]);

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#2563eb]" />}
      title="Nueva Factura de Venta"
      subtitle="Se genera desde una Orden de Venta OPEN. Permite parcial, lote/serial y contado/crédito."
      chips={
        <>
          <Chip tone="neutral">Líneas: {chips.count}</Chip>
          <Chip tone="info">Con qty: {chips.pendingLines}</Chip>
          <Chip tone="warn">Sub est.: {fmtPY.format(totals.sub)}</Chip>
          {orderInfo ? <Chip tone="neutral">OV: {orderInfo.docNumber}</Chip> : null}
        </>
      }
      right={
        <>
          <Button variant="outline" onClick={() => router.push("/sales-invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Button onClick={refresh} variant="outline" disabled={loading} title="Recargar OV y datos">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={save}
            disabled={loading}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            title="Crear factura (descuenta stock)"
          >
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      {/* CABECERA */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ShoppingCart className="h-5 w-5 text-[#2563eb]" />}
          title="Cabecera"
          subtitle="Seleccioná la OV, fecha, condición de pago y comentarios."
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Orden de Venta (OPEN)</label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-white"
              value={salesOrderId}
              onChange={async (e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setSalesOrderId(v as any);
                if (v) await loadOrder(Number(v));
                else {
                  setOrderInfo(null);
                  setLinesFromOrder([]);
                  setLines([]);
                }
              }}
              disabled={loading}
            >
              <option value="">-- Seleccione --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.docNumber} - {o.customerName}
                </option>
              ))}
            </select>

            {orderInfo && (
              <div className="text-xs text-gray-500 mt-1">
                Cliente: <span className="font-semibold">{orderInfo.customerName}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Fecha</label>
            <div className="relative">
              <CalendarDays className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="pl-9 bg-white"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Pago</label>

            <div className="relative">
              <CreditCard className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                className="w-full border rounded-md h-10 pl-9 pr-3 bg-white"
                value={paymentType}
                onChange={(e) => setPaymentType((e.target.value as any) ?? "CASH")}
                disabled={loading}
              >
                <option value="CASH">CONTADO</option>
                <option value="CREDIT">CRÉDITO</option>
              </select>
            </div>

            {paymentType === "CREDIT" && (
              <div className="mt-2">
                <label className="text-xs font-semibold text-gray-600">Cuotas</label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                  disabled={loading}
                  className="bg-white"
                />
              </div>
            )}
          </div>

          <div className="md:col-span-4">
            <label className="text-sm font-semibold text-gray-700">Comentarios</label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Observaciones..."
              disabled={loading}
              className="bg-white"
            />
          </div>
        </div>
      </Card>

      {/* LÍNEAS */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5 text-[#2563eb]" />}
          title="Líneas a facturar"
          subtitle="Permite parcial. Si el producto requiere lote/serial, completalo."
          right={
            <Button
              variant="outline"
              onClick={addEmptyLine}
              title="Agregar línea manual (para parcial)"
              disabled={loading}
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar línea
            </Button>
          }
        />

        <Separator className="my-4" />

        <div className="space-y-3">
          {lines.map((l, idx) => {
            const soLine = l.salesOrderLineId
              ? linesFromOrder.find((x) => x.id === Number(l.salesOrderLineId))
              : null;

            const pending = soLine
              ? Math.max(0, Number(soLine.quantity) - Number(soLine.invoicedQuantity))
              : l.pendingQty ?? 0;

            const isBatch = Boolean(soLine?.isBatchManaged);
            const isSerial = Boolean(soLine?.isSerialManaged);

            return (
              <div
                key={idx}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-gray-50 p-3 rounded-lg border"
              >
                <div className="lg:col-span-5">
                  <label className="text-xs font-semibold text-gray-600">Producto (línea OV)</label>
                  <select
                    className="w-full border rounded-md h-10 px-3 bg-white"
                    value={l.salesOrderLineId ? String(l.salesOrderLineId) : ""}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : "";
                      const pick = v ? linesFromOrder.find((x) => x.id === v) : null;

                      setLine(idx, {
                        salesOrderLineId: v as any,
                        productLabel: pick ? `${pick.productCode} - ${pick.productName}` : "",
                        pendingQty: pick
                          ? Math.max(0, Number(pick.quantity) - Number(pick.invoicedQuantity))
                          : 0,
                        quantity: pick
                          ? Math.max(0, Number(pick.quantity) - Number(pick.invoicedQuantity))
                          : 1,
                        batchNumber: null,
                        serialNumbers: null,
                      });
                    }}
                    disabled={loading}
                  >
                    <option value="">-- Seleccione --</option>
                    {linesFromOrder
                      .map((x) => ({
                        ...x,
                        pendingQty: Math.max(0, Number(x.quantity) - Number(x.invoicedQuantity)),
                      }))
                      .filter((x) => x.pendingQty > 0)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.productCode} - {x.productName} (Pend: {x.pendingQty})
                        </option>
                      ))}
                  </select>

                  {soLine ? (
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span className="px-2 py-0.5 rounded bg-white border">
                        Precio: <b>{fmtPY.format(Number(soLine.unitPrice ?? 0))}</b>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border">
                        Desc: <b>{Number(soLine.discountPercent ?? 0)}%</b>
                      </span>
                      {isBatch ? (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          Requiere lote
                        </span>
                      ) : null}
                      {isSerial ? (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                          Requiere seriales
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })}
                    disabled={loading}
                    className="bg-white"
                  />
                  <div className="text-[11px] text-gray-500 mt-1">Pendiente: {pending}</div>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">
                    Lote {isBatch ? "(requerido)" : "(si aplica)"}
                  </label>
                  <Input
                    value={l.batchNumber ?? ""}
                    onChange={(e) => setLine(idx, { batchNumber: e.target.value })}
                    placeholder="BatchNumber"
                    disabled={loading}
                    className="bg-white"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs font-semibold text-gray-600">
                    Seriales {isSerial ? "(requerido)" : "(si aplica)"}
                  </label>
                  <Input
                    value={l.serialNumbers ?? ""}
                    onChange={(e) => setLine(idx, { serialNumbers: e.target.value })}
                    placeholder="SN1,SN2,SN3"
                    disabled={loading}
                    className="bg-white"
                  />
                  {isSerial ? (
                    <div className="text-[11px] text-gray-500 mt-1">
                      Cant (entera): <b>{Math.trunc(Number(l.quantity ?? 0))}</b> — Seriales:{" "}
                      <b>
                        {(String(l.serialNumbers ?? "") || "")
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean).length}
                      </b>
                    </div>
                  ) : null}
                </div>

                <div className="lg:col-span-12 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeLine(idx)}
                    className="hover:bg-red-50"
                    title="Eliminar línea"
                    disabled={loading || lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="my-4" />

        {/* TOTALES (estimado) */}
        <div className="flex flex-col items-end gap-1">
          <div className="text-sm text-gray-700">
            Subtotal estimado: <span className="font-semibold">{fmtPY.format(totals.sub)}</span>
          </div>
          <div className="text-[11px] text-gray-500">
            *El total real lo calcula el backend con impuestos/rounding.
          </div>
        </div>
      </Card>
    </PageShell>
  );
}