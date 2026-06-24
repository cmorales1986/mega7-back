"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Link from "next/link";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

import { ArrowLeft, RefreshCcw, Save, ReceiptText } from "lucide-react";

import {
  getPurchaseReceiptById,
  updatePurchaseReceiptDocuments,
  updatePurchaseReceiptPricing,
} from "@/features/purchasing/purchase-receipts/api";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");
const money = (n: any) => fmtPY.format(Number(n || 0));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

type DocRow = { type: "DELIVERY_NOTE" | "INVOICE"; number: string; date?: string };

export default function PurchaseReceiptEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const idNum = Number(id);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  const [docs, setDocs] = useState<DocRow[]>([
    { type: "DELIVERY_NOTE", number: "", date: "" },
    { type: "INVOICE", number: "", date: "" },
  ]);

  const [priceLines, setPriceLines] = useState<
    Array<{ lineId: number; productName: string; quantity: number; unitPrice: number; discountPercent: number; taxId?: number | null }>
  >([]);

  async function load() {
    if (!idNum || Number.isNaN(idNum)) return;
    setLoading(true);
    try {
      const data = await getPurchaseReceiptById(idNum);
      setDoc(data);

      // documentos (1 por tipo)
      const dList = (data?.documents ?? []) as any[];
      const dn = dList.find((x) => String(x.type).toUpperCase() === "DELIVERY_NOTE");
      const inv = dList.find((x) => String(x.type).toUpperCase() === "INVOICE");

      setDocs([
        { type: "DELIVERY_NOTE", number: dn?.number ?? "", date: "" },
        { type: "INVOICE", number: inv?.number ?? "", date: "" },
      ]);

      // líneas para pricing
      const lines = (data?.lines ?? []) as any[];
      setPriceLines(
        lines.map((l) => ({
          lineId: l.id,
          productName: l.productName,
          quantity: Number(l.quantity ?? 0),
          unitPrice: Number(l.unitPrice ?? 0),
          discountPercent: Number(l.discountPercent ?? 0),
          taxId: l.taxId ?? null,
        }))
      );
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar", "error");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [idNum]);

  async function saveAll() {
    if (!doc) return;

    // validaciones suaves
    const docsToSend = docs
      .map((d) => ({
        type: d.type,
        number: (d.number ?? "").trim(),
        date: d.date ? new Date(d.date).toISOString() : null,
      }))
      .filter((d) => d.number.length > 0);

    const pricingToSend = priceLines.map((l) => ({
      lineId: l.lineId,
      unitPrice: Number(l.unitPrice || 0),
      discountPercent: Number(l.discountPercent || 0),
      taxId: l.taxId ?? null,
    }));

    setLoading(true);
    try {
      await updatePurchaseReceiptDocuments(idNum, docsToSend);
      const pricingRes = await updatePurchaseReceiptPricing(idNum, pricingToSend);

      Swal.fire("OK", "Cambios guardados. Totales recalculados.", "success");

      // refrescar para ver totales actualizados
      await load();
      return pricingRes;
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo guardar", "error");
    } finally {
      setLoading(false);
    }
  }

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "productName", headerName: "Producto", flex: 1, minWidth: 260 },
      {
        field: "quantity",
        headerName: "Cant.",
        width: 110,
        align: "center",
        headerAlign: "center",
        valueFormatter: (p: any) => money(p?.value),
      },
      {
        field: "unitPrice",
        headerName: "Precio",
        width: 140,
        editable: true,
        align: "right",
        headerAlign: "right",
        valueFormatter: (p: any) => money(p?.value),
      },
      {
        field: "discountPercent",
        headerName: "Desc %",
        width: 120,
        editable: true,
        align: "center",
        headerAlign: "center",
        valueFormatter: (p: any) => String(p?.value ?? 0),
      },
      {
        field: "taxId",
        headerName: "TaxId",
        width: 110,
        editable: true,
        align: "center",
        headerAlign: "center",
      },
    ],
    []
  );

  return (
    <PageShell
      icon={<ReceiptText className="h-6 w-6 text-[#C5A05A]" />}
      title={`Editar Recepción #${doc?.docNumber ?? idNum}`}
      subtitle="Permite editar documentos y precios (no toca stock)."
      right={
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => router.push(`/purchase-receipts/${idNum}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Button variant="outline" className="bg-white" onClick={load}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white" onClick={saveAll} disabled={loading}>
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
        </div>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        {!doc ? (
          <div className="text-gray-600">{loading ? "Cargando..." : "Sin datos"}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="font-semibold">{fmtDate(doc.receiptDate)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Proveedor</div>
                <div className="font-semibold">{doc.supplierName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Depósito</div>
                <div className="font-semibold">{doc?.warehouse?.name ?? ""}</div>
              </div>
              <div className="md:text-right">
                <div className="text-xs text-gray-500">Total actual</div>
                <div className="text-xl font-bold">{money(doc.total)}</div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold mb-3">Documentos</div>

                <div className="grid grid-cols-1 gap-3">
                  {docs.map((d, idx) => (
                    <div key={d.type} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4 text-xs font-semibold text-gray-700">{d.type}</div>
                      <div className="col-span-8">
                        <Input
                          className="bg-white"
                          placeholder="Número"
                          value={d.number}
                          onChange={(e) => {
                            const copy = [...docs];
                            copy[idx] = { ...copy[idx], number: e.target.value };
                            setDocs(copy);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  * Si dejás vacío un tipo, se elimina al guardar (por tu endpoint).
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold mb-2">Regla</div>
                <div className="text-sm text-gray-700">
                  Este editor solo recalcula totales del documento. El costo de stock ya fue aplicado al crear.
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Si querés “re-costear” stock por cambios de precio, lo hacemos con un proceso separado (revalorización).
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="border-slate-200 p-4 shadow-sm">
        <ThemeProvider theme={muiTheme}>
          <div className="h-[560px]">
            <DataGrid
              rows={priceLines}
              columns={columns}
              loading={loading}
              getRowId={(r) => (r as any).lineId}
              pageSizeOptions={[10, 20, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              disableRowSelectionOnClick
              processRowUpdate={(newRow) => {
                setPriceLines((prev) =>
                  prev.map((r) => (r.lineId === newRow.lineId ? { ...newRow } : r))
                );
                return newRow;
              }}
              onProcessRowUpdateError={(err) => {
                console.error(err);
                Swal.fire("Error", "No se pudo actualizar la fila.", "error");
              }}
            />
          </div>
        </ThemeProvider>

        <div className="text-xs text-gray-500 mt-2">
          * Editá <b>unitPrice</b>, <b>discountPercent</b> y <b>taxId</b>, luego Guardar.
        </div>
      </Card>
    </PageShell>
  );
}
