"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { PageShell } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { Plus, Pencil, RefreshCcw, FileText, List } from "lucide-react";

const muiTheme = createTheme({}, esES);

type FiscalSeries = {
  id: number;
  documentType: string;
  timbradoNumber: string;
  validFrom: string;
  validTo: string;
  establishment: string;
  expeditionPoint: string;
  seriesName?: string | null;
  rangeFrom: number;
  rangeTo: number;
  nextNumber: number;
  isActive: boolean;
  location?: string | null;
};

type Upsert = {
  documentType: string;
  timbradoNumber: string;
  validFrom: string; // yyyy-mm-dd
  validTo: string;   // yyyy-mm-dd
  establishment: string;
  expeditionPoint: string;
  seriesName: string;
  rangeFrom: number;
  rangeTo: number;
  nextNumber: number;
  isActive: boolean;
  location: string;
};

const toISODate = (d: any) => {
  const x = new Date(d);
  if (!Number.isFinite(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
};

const safeMsg = (e: any, fallback: string) => {
  const data = e?.response?.data;
  if (!data) return `${fallback} (${e?.response?.status ?? "sin conexión"})`;
  if (typeof data === "string") return data;
  // ASP.NET problem details: { title, errors }
  if (data.errors) {
    const msgs = Object.values(data.errors).flat().join(" | ");
    return msgs || data.title || fallback;
  }
  if (data.title) return data.title;
  try { return JSON.stringify(data); } catch { return fallback; }
};

export default function FiscalDocumentSeriesPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FiscalSeries[]>([]);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const empty: Upsert = {
    documentType: "FACTURA",
    timbradoNumber: "",
    validFrom: toISODate(new Date()),
    validTo: toISODate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
    establishment: "001",
    expeditionPoint: "001",
    seriesName: "",
    rangeFrom: 1,
    rangeTo: 9999999,
    nextNumber: 1,
    isActive: true,
    location: "",
  };

  const [form, setForm] = useState<Upsert>(empty);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/fiscaldocumentseries");
      setRows(r.data ?? []);
    } catch (e: any) {
      Swal.fire("Error", safeMsg(e, "No se pudo cargar series fiscales"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (r: FiscalSeries) => {
    setEditId(r.id);
    setForm({
      documentType: r.documentType ?? "FACTURA",
      timbradoNumber: r.timbradoNumber ?? "",
      validFrom: toISODate(r.validFrom),
      validTo: toISODate(r.validTo),
      establishment: r.establishment ?? "001",
      expeditionPoint: r.expeditionPoint ?? "001",
      seriesName: r.seriesName ?? "",
      rangeFrom: Number(r.rangeFrom ?? 1),
      rangeTo: Number(r.rangeTo ?? 1),
      nextNumber: Number(r.nextNumber ?? 1),
      isActive: !!r.isActive,
      location: r.location ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    // validaciones mínimas (backend también valida rango) :contentReference[oaicite:7]{index=7}
    if (!form.timbradoNumber.trim()) return Swal.fire("Validación", "Timbrado es requerido.", "warning");
    if (!form.validFrom || !form.validTo) return Swal.fire("Validación", "Vigencia inválida.", "warning");
    if (form.rangeFrom <= 0 || form.rangeTo <= 0 || form.rangeFrom > form.rangeTo)
      return Swal.fire("Validación", "Rango inválido.", "warning");

    setLoading(true);
    try {
      const payload = {
        documentType: (form.documentType ?? "FACTURA").trim().toUpperCase(),
        timbradoNumber: form.timbradoNumber.trim(),
        validFrom: new Date(form.validFrom).toISOString(),
        validTo: new Date(form.validTo).toISOString(),
        establishment: (form.establishment ?? "001").trim(),
        expeditionPoint: (form.expeditionPoint ?? "001").trim(),
        seriesName: form.seriesName?.trim() || null,
        rangeFrom: Number(form.rangeFrom),
        rangeTo: Number(form.rangeTo),
        nextNumber: Number(form.nextNumber),
        isActive: !!form.isActive,
        location: form.location?.trim() || null,
      };

      if (editId) await api.put(`/fiscaldocumentseries/${editId}`, payload);
      else await api.post(`/fiscaldocumentseries`, payload);

      Swal.fire("OK", editId ? "Serie actualizada." : "Serie creada.", "success");
      setOpen(false);
      await load();
    } catch (e: any) {
      Swal.fire("Error", safeMsg(e, "No se pudo guardar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const canCreate = usePermission("FiscalDocumentSeries.Create");
  const canEdit = usePermission("FiscalDocumentSeries.Edit");

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 80 },
      { field: "documentType", headerName: "Tipo", width: 120 },
      { field: "seriesName", headerName: "Nombre", flex: 1, minWidth: 160 },
      { field: "timbradoNumber", headerName: "Timbrado", width: 140 },
      {
        field: "prefix",
        headerName: "Est.-Pto",
        width: 130,
        valueGetter: (_: any, r: any) => `${r.establishment}-${r.expeditionPoint}`,
      },
      {
        field: "vigencia",
        headerName: "Vigencia",
        width: 210,
        valueGetter: (_: any, r: any) => `${toISODate(r.validFrom)} → ${toISODate(r.validTo)}`,
      },
      {
        field: "range",
        headerName: "Rango",
        width: 170,
        valueGetter: (_: any, r: any) => `${r.rangeFrom} - ${r.rangeTo}`,
      },
      { field: "nextNumber", headerName: "Próximo", width: 120 },
      {
        field: "isActive",
        headerName: "Activo",
        width: 100,
        valueGetter: (_: any, r: any) => (r.isActive ? "Sí" : "No"),
      },
      {
        field: "actions",
        headerName: "",
        width: 120,
        sortable: false,
        renderCell: (p) => (
          canEdit ? (
            <Button variant="outline" className="bg-white" onClick={() => openEdit(p.row)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          ) : null
        ),
      },
    ],
    [canEdit]
  );

  return (
    <PageShell
        icon= {<FileText className="h-6 w-6 text-[#dba3d8]" />}
      title="Series Fiscales (Timbrados)"
      subtitle="Administrá talonarios / rangos / próximo número para facturación."
      right={
        <>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refrescar
          </Button>
          {canCreate && (
            <Button className="bg-[#C5A05A] hover:bg-[#b8934f] text-white" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo
            </Button>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
            icon={<List className="h-6 w-6 text-[#dba3d8]" />}
          title="Listado"
          subtitle="No hay delete en backend: desactivá una serie si no se usa."
        />
        <Separator className="my-4" />

        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 560, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(r) => r.id}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25, page: 0 } },
              }}
            />
          </div>
        </ThemeProvider>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar serie fiscal" : "Nueva serie fiscal"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Tipo</label>
              <Input
                value={form.documentType}
                onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Timbrado</label>
              <Input
                value={form.timbradoNumber}
                onChange={(e) => setForm((p) => ({ ...p, timbradoNumber: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Nombre (opcional)</label>
              <Input
                value={form.seriesName}
                onChange={(e) => setForm((p) => ({ ...p, seriesName: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Válido desde</label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Válido hasta</label>
              <Input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-[#C5A05A]"
                />
                <span className="text-sm font-semibold text-gray-700">Activa</span>
              </label>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Establecimiento</label>
              <Input
                value={form.establishment}
                onChange={(e) => setForm((p) => ({ ...p, establishment: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Punto expedición</label>
              <Input
                value={form.expeditionPoint}
                onChange={(e) => setForm((p) => ({ ...p, expeditionPoint: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Ubicación (opcional)</label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Rango desde</label>
              <Input
                type="number"
                value={form.rangeFrom}
                onChange={(e) => setForm((p) => ({ ...p, rangeFrom: Number(e.target.value) }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Rango hasta</label>
              <Input
                type="number"
                value={form.rangeTo}
                onChange={(e) => setForm((p) => ({ ...p, rangeTo: Number(e.target.value) }))}
                className="bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Próximo número</label>
              <Input
                type="number"
                value={form.nextNumber}
                onChange={(e) => setForm((p) => ({ ...p, nextNumber: Number(e.target.value) }))}
                className="bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={loading}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white"
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
