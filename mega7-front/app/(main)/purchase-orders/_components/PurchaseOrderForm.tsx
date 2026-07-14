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

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  ArrowLeft,
  ClipboardList,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ✅ tus componentes base
import { PageShell } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { toErrorMsg } from "@/lib/api-error";

const fmtPY = new Intl.NumberFormat("es-PY");

type Supplier = { id: number; razonSocial: string; partnerType: string };
type Warehouse = { id: number; name: string };
type Product = { id: number; code: string; name: string; taxId?: number | null };
type Tax = { id: number; name: string; rate: number };

type LineDraft = {
  _tmpId: string;
  productId: number | "";
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | "" | null;
};

const uid = () => Math.random().toString(36).slice(2);

export default function PurchaseOrderForm({ editingId }: { editingId?: number }) {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);

  const [orderDate, setOrderDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [comments, setComments] = useState<string>("");

  const [lines, setLines] = useState<LineDraft[]>([
    {
      _tmpId: uid(),
      productId: "",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxId: "",
    },
  ]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );
  const taxMap = useMemo(() => new Map(taxes.map((t) => [t.id, t])), [taxes]);

  const selectedSupplier = useMemo(() => {
    if (!supplierId) return null;
    return suppliers.find((s) => s.id === Number(supplierId)) ?? null;
  }, [supplierId, suppliers]);

  const totals = useMemo(() => {
    let sub = 0;
    let tax = 0;

    for (const l of lines) {
      if (!l.productId || l.quantity <= 0) continue;

      const discountFactor = (100 - (l.discountPercent || 0)) / 100;
      const lineSub = round2(l.quantity * (l.unitPrice || 0) * discountFactor);

      const tid =
        l.taxId === ""
          ? productMap.get(Number(l.productId))?.taxId ?? null
          : l.taxId;

      const rate = tid ? taxMap.get(Number(tid))?.rate ?? 0 : 0;
      const lineTax = round2(lineSub * (rate / 100));

      sub += lineSub;
      tax += lineTax;
    }

    const total = round2(sub + tax);
    return { sub: round2(sub), tax: round2(tax), total };
  }, [lines, productMap, taxMap]);

  const loadLookups = async () => {
    const [sup, wh, pr, tx] = await Promise.all([
      api.get("/sociosnegocio/proveedores"),
      api.get("/warehouses"),
      api.get("/products"),
      api.get("/taxes"),
    ]);

    setSuppliers(sup.data ?? []);
    setWarehouses(wh.data ?? []);
    setProducts(pr.data ?? []);
    setTaxes(tx.data ?? []);
  };

  const loadDocIfEdit = async () => {
    if (!editingId) return;

    const res = await api.get(`/purchaseorders/${editingId}`);
    const doc = res.data;

    if (doc.status !== "DRAFT") {
      Swal.fire("Bloqueado", "Solo podés editar una OC en estado DRAFT.", "warning");
      router.push("/purchase-orders");
      return;
    }

    setOrderDate((doc.orderDate ?? "").slice(0, 10));
    setSupplierId(doc.supplierId);
    setWarehouseId(doc.warehouseId);
    setComments(doc.comments ?? "");

    const mapped = (doc.lines ?? []).map((l: any) => ({
      _tmpId: uid(),
      productId: l.productId,
      quantity: Number(l.quantity ?? 0),
      unitPrice: Number(l.unitPrice ?? 0),
      discountPercent: Number(l.discountPercent ?? 0),
      taxId: l.taxId ?? "",
    }));

    setLines(
      mapped.length
        ? mapped
        : [
            {
              _tmpId: uid(),
              productId: "",
              quantity: 1,
              unitPrice: 0,
              discountPercent: 0,
              taxId: "",
            },
          ]
    );
  };

  useEffect(() => {
    (async () => {
      try {
        await loadLookups();
        await loadDocIfEdit();
      } catch (e: any) {
        Swal.fire("Error", toErrorMsg(e, "No se pudo cargar datos"), "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        _tmpId: uid(),
        productId: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        taxId: "",
      },
    ]);
  };

  const removeLine = (tmpId: string) => {
    setLines((prev) => {
      const next = prev.filter((x) => x._tmpId !== tmpId);
      return next.length
        ? next
        : [
            {
              _tmpId: uid(),
              productId: "",
              quantity: 1,
              unitPrice: 0,
              discountPercent: 0,
              taxId: "",
            },
          ];
    });
  };

  const setLine = (tmpId: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l._tmpId === tmpId ? { ...l, ...patch } : l)));
  };

  const validateForm = (): string | null => {
    if (!supplierId) return "Seleccioná un proveedor.";
    if (!warehouseId) return "Seleccioná un depósito.";

    const validLines = lines.filter((l) => l.productId && l.quantity > 0);
    if (!validLines.length) return "Cargá al menos 1 línea con producto y cantidad > 0.";

    for (const l of validLines) {
      if (l.unitPrice < 0) return "El precio no puede ser negativo.";
      if (l.discountPercent < 0 || l.discountPercent > 100)
        return "El descuento debe estar entre 0 y 100.";
    }
    return null;
  };

  const buildPayload = () => ({
    orderDate: new Date(orderDate).toISOString(),
    supplierId: Number(supplierId),
    warehouseId: Number(warehouseId),
    comments: comments?.trim() || null,
    lines: lines
      .filter((l) => l.productId && l.quantity > 0)
      .map((l) => ({
        productId: Number(l.productId),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent || 0),
        taxId: l.taxId === "" ? null : (l.taxId as any),
      })),
  });

  const save = async () => {
    const err = validateForm();
    if (err) return Swal.fire("Validación", err, "warning");

    try {
      const payload = buildPayload();

      if (!editingId) {
        await api.post("/purchaseorders", payload);
        Swal.fire("OK", "Orden de compra creada", "success");
      } else {
        await api.put(`/purchaseorders/${editingId}`, { ...payload, status: "DRAFT" });
        Swal.fire("OK", "Orden de compra actualizada", "success");
      }

      router.push("/purchase-orders");
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar"), "error");
    }
  };

  return (
    <PageShell
      icon={<ClipboardList className="h-6 w-6 text-[#C5A05A]" />}
      title={editingId ? "Editar Orden de Compra" : "Nueva Orden de Compra"}
      subtitle="Completá cabecera y líneas. El total se calcula automáticamente con impuestos y descuentos."
      right={
        <>
          <Button variant="outline" className="bg-white" onClick={() => router.push("/purchase-orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Button onClick={save} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
            Guardar
          </Button>
        </>
      }
    >
      {/* CABECERA */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<FileText className="h-5 w-5 text-[#C5A05A]" />}
          title="Cabecera"
          subtitle="Proveedor, depósito, fecha y comentarios."
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Fecha</label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>

          {/* PROVEEDOR (Autocomplete) */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Proveedor</label>

            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full h-10 px-3 flex items-center justify-between rounded-md border bg-white text-sm",
                    "hover:bg-gray-50",
                    "focus:outline-none focus:ring-2 focus:ring-[#C5A05A]/30 focus:border-[#C5A05A]/40"
                  )}
                >
                  <span className={cn(!supplierId && "text-gray-400 bg-white")}>
                    {supplierId
                      ? suppliers.find((s) => s.id === supplierId)?.razonSocial
                      : "Buscar proveedor..."}
                  </span>

                  <ChevronsUpDown className="h-4 w-4 opacity-60 bg-white" />
                </button>
              </PopoverTrigger>

              <PopoverContent
                align="start"
                className={cn(
                  "w-[--radix-popover-trigger-width] p-0 bg-white border shadow-xl rounded-md overflow-hidden"
                )}
              >
                <Command className="bg-white">
                  <div className="border-b px-2">
                    <CommandInput
                      placeholder="Buscar proveedor..."
                      className={cn(
                        "h-10 border-0 bg-white shadow-none",
                        "focus-visible:ring-0 focus-visible:ring-offset-0"
                      )}
                    />
                  </div>

                  <CommandList className="max-h-64 overflow-y-auto bg-white">
                    <CommandEmpty className="py-6 text-center text-sm text-gray-500">
                      No se encontró proveedor.
                    </CommandEmpty>

                    <CommandGroup>
                      {suppliers.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.razonSocial} ${s.id}`}
                          onSelect={() => {
                            setSupplierId(s.id);
                            setSupplierOpen(false);
                          }}
                          className="cursor-pointer aria-selected:bg-gray-100"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              supplierId === s.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {s.razonSocial}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedSupplier ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Seleccionado: <span className="font-medium">{selectedSupplier.razonSocial}</span>
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Depósito</label>
            <Select value={warehouseId ? String(warehouseId) : ""} onValueChange={(v) => setWarehouseId(Number(v))}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Seleccione depósito" />
              </SelectTrigger>
              <SelectContent className="bg-white shadow-md">
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)} className="hover:bg-gray-100">
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <label className="text-sm font-semibold text-gray-700">Comentarios</label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
      </Card>

      {/* LÍNEAS */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<ClipboardList className="h-5 w-5 text-[#C5A05A]" />}
          title="Líneas"
          subtitle="Agregá productos, cantidades, descuentos e impuestos."
          right={
            <Button variant="outline" className="bg-white" onClick={addLine}>
              <Plus className="mr-2 h-4 w-4" /> Agregar línea
            </Button>
          }
        />

        <Separator className="my-4" />

        <div className="space-y-3">
          {lines.map((l) => {
            const p = l.productId ? productMap.get(Number(l.productId)) : null;
            const defaultTaxId = p?.taxId ?? null;

            return (
              <div
                key={l._tmpId}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-xl border"
              >
                <div className="lg:col-span-5">
                  <label className="text-xs font-semibold text-gray-600">Producto</label>
                  <Select
                    value={l.productId ? String(l.productId) : ""}
                    onValueChange={(v) => {
                      const pid = Number(v);
                      const prod = productMap.get(pid);
                      setLine(l._tmpId, { productId: pid, taxId: prod?.taxId ?? "" });
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Seleccione producto" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-md">
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                  <Input
                    type="number"
                    value={l.quantity}
                    min={0}
                    step="0.01"
                    onChange={(e) => setLine(l._tmpId, { quantity: Number(e.target.value) })}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Precio</label>
                  <Input
                    type="number"
                    value={l.unitPrice}
                    min={0}
                    step="0.01"
                    onChange={(e) => setLine(l._tmpId, { unitPrice: Number(e.target.value) })}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-gray-600">Desc %</label>
                  <Input
                    type="number"
                    value={l.discountPercent}
                    min={0}
                    max={100}
                    step="0.01"
                    onChange={(e) => setLine(l._tmpId, { discountPercent: Number(e.target.value) })}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Impuesto</label>
                  <Select
                    value={l.taxId === "" ? "" : String(l.taxId ?? "")}
                    onValueChange={(v) => setLine(l._tmpId, { taxId: v ? Number(v) : "" })}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={defaultTaxId ? "Por defecto" : "Seleccione"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-md">
                      {taxes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="text-[11px] text-muted-foreground mt-1">
                    {defaultTaxId
                      ? `Default prod: ${taxMap.get(defaultTaxId)?.name ?? ""}`
                      : "Sin impuesto por defecto"}
                  </div>
                </div>

                <div className="lg:col-span-12 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeLine(l._tmpId)}
                    className="bg-white hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* TOTALES */}
        <div className="mt-6 flex flex-col items-end gap-1">
          <div className="text-sm text-gray-700">
            Subtotal: <span className="font-semibold">{fmtPY.format(totals.sub)}</span>
          </div>
          <div className="text-sm text-gray-700">
            Impuestos: <span className="font-semibold">{fmtPY.format(totals.tax)}</span>
          </div>
          <div className="text-base text-gray-900">
            Total: <span className="font-bold">{fmtPY.format(totals.total)}</span>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
