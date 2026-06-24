"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// MUI
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import {
  Plus,
  RefreshCcw,
  Pencil,
  Trash2,
  Power,
  Eye,
  Truck,
  Search,
  BadgeCheck,
  Ban,
} from "lucide-react";

// ✅ componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

const muiTheme = createTheme({}, esES);

type CreditTerm = {
  id: number;
  name: string;
  days: number;
  isActive: boolean;
};

type SocioNegocio = {
  id: number;
  partnerType: string; // "C" | "S" | "A"
  code: string;
  razonSocial: string;
  ruc: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  isActive: boolean;

  // Crédito / Cuotas
  creditTermId?: number | null;
  creditLimit?: number | null;
  allowInstallments?: boolean;
  maxInstallments?: number | null;
  defaultInstallments?: number | null;

  creditTerm?: CreditTerm | null;
};

const emptyForm = (): Partial<SocioNegocio> => ({
  partnerType: "S",
  code: "",
  razonSocial: "",
  ruc: "",
  contacto: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  isActive: true,

  creditTermId: null,
  creditLimit: null,
  allowInstallments: false,
  maxInstallments: null,
  defaultInstallments: null,
});

const toIntOrNull = (v: any) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toNumOrNull = (v: any) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function SociosProveedoresPage() {
  const router = useRouter();

  const [rows, setRows] = useState<SocioNegocio[]>([]);
  const [terms, setTerms] = useState<CreditTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SocioNegocio | null>(null);
  const [form, setForm] = useState<Partial<SocioNegocio>>(emptyForm());

  async function loadTerms() {
    try {
      const res = await api.get("/creditterms");
      const list: CreditTerm[] = res.data ?? [];
      setTerms(list.filter((x) => x.isActive));
    } catch {
      setTerms([]);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/sociosnegocio/proveedores");
      setRows(res.data ?? []);
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data ?? "No se pudo cargar proveedores", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTerms();
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay =
        `${r.code} ${r.razonSocial} ${r.ruc} ${r.telefono ?? ""} ${r.email ?? ""} ${r.ciudad ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((x) => x.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [rows]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpenModal(true);
  };

  const openEdit = (row: SocioNegocio) => {
    setEditing(row);
    setForm({
      ...row,
      partnerType: "S",
      creditTermId: row.creditTermId ?? null,
      creditLimit: row.creditLimit ?? null,
      allowInstallments: !!row.allowInstallments,
      maxInstallments: row.maxInstallments ?? null,
      defaultInstallments: row.defaultInstallments ?? null,
    });
    setOpenModal(true);
  };

  const validate = (): string | null => {
    const razon = (form.razonSocial ?? "").trim();
    const ruc = (form.ruc ?? "").trim();

    if (!razon) return "Razón Social es obligatoria.";
    if (!ruc) return "RUC es obligatorio.";

    const allow = !!form.allowInstallments;
    const max = form.maxInstallments ?? null;
    const def = form.defaultInstallments ?? null;

    if (allow) {
      if (!max || max < 2)
        return "Máx. cuotas debe ser >= 2 si 'Permitir cuotas' está activo.";
      if (!def || def < 1) return "Cuotas por defecto debe ser >= 1.";
      if (def > max) return "Cuotas por defecto no puede ser mayor a Máx. cuotas.";
    }

    return null;
  };

  async function save() {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    setSaving(true);
    try {
      const payload = {
        partnerType: "S",
        code: editing ? editing.code : "",
        razonSocial: (form.razonSocial ?? "").trim(),
        ruc: (form.ruc ?? "").trim(),
        contacto: form.contacto?.trim() || null,
        telefono: form.telefono?.trim() || null,
        email: form.email?.trim() || null,
        direccion: form.direccion?.trim() || null,
        ciudad: form.ciudad?.trim() || null,
        isActive: form.isActive ?? true,

        creditTermId: form.creditTermId ?? null,
        creditLimit: toNumOrNull(form.creditLimit),

        allowInstallments: !!form.allowInstallments,
        maxInstallments: !!form.allowInstallments ? toIntOrNull(form.maxInstallments) : null,
        defaultInstallments: !!form.allowInstallments ? toIntOrNull(form.defaultInstallments) : null,
      };

      if (!editing) {
        await api.post("/sociosnegocio", payload);
        Swal.fire("OK", "Proveedor creado correctamente.", "success");
      } else {
        await api.put(`/sociosnegocio/${editing.id}`, { id: editing.id, ...payload });
        Swal.fire("OK", "Proveedor actualizado.", "success");
      }

      setOpenModal(false);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo guardar.", "error");
    }
    setSaving(false);
  }

  async function toggleActive(row: SocioNegocio) {
    const action = row.isActive ? "desactivar" : "activar";

    const r = await Swal.fire({
      title: "Confirmar",
      text: `¿Deseas ${action} a "${row.razonSocial}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "Cancelar",
    });

    if (!r.isConfirmed) return;

    try {
      const payload = {
        ...row,
        partnerType: "S",
        isActive: !row.isActive,
        creditTermId: row.creditTermId ?? null,
        creditLimit: row.creditLimit ?? null,
        allowInstallments: !!row.allowInstallments,
        maxInstallments: row.maxInstallments ?? null,
        defaultInstallments: row.defaultInstallments ?? null,
      };

      await api.put(`/sociosnegocio/${row.id}`, payload);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo actualizar estado.", "error");
    }
  }

  async function remove(row: SocioNegocio) {
    const r = await Swal.fire({
      title: "Eliminar",
      text: `¿Eliminar "${row.razonSocial}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!r.isConfirmed) return;

    try {
      await api.delete(`/sociosnegocio/${row.id}`);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo eliminar.", "error");
    }
  }

  const canCreate = usePermission("Suppliers.Create");
  const canEdit = usePermission("Suppliers.Edit");
  const canDelete = usePermission("Suppliers.Delete");

  const columns: GridColDef[] = [
    { field: "code", headerName: "Código", width: 110 },
    { field: "razonSocial", headerName: "Razón Social", flex: 1, minWidth: 280 },
    { field: "ruc", headerName: "RUC", width: 160 },
    { field: "telefono", headerName: "Teléfono", width: 150 },
    { field: "email", headerName: "Email", width: 240 },
    { field: "ciudad", headerName: "Ciudad", width: 160 },
    {
      field: "isActive",
      headerName: "Estado",
      width: 140,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            params.value
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          {params.value ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 210,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => {
        const row: SocioNegocio = params.row;

        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => router.push(`/socios-negocio/proveedores/${row.id}`)}
              title="Ver / Sucursales"
            >
              <Eye className="h-4 w-4" />
            </Button>

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => openEdit(row)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => toggleActive(row)}
                title={row.isActive ? "Desactivar" : "Activar"}
              >
                <Power className="h-4 w-4" />
              </Button>
            )}

            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 hover:bg-red-50 border-red-300 text-red-600"
                onClick={() => remove(row)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      icon={<Truck className="h-5 w-5 text-slate-700" />}
      title="Proveedores"
      subtitle="Socios de negocio (tipo Proveedor)"
      chips={
        <>
          <Chip tone="neutral">Total: {stats.total}</Chip>
          <Chip tone="ok">
            <BadgeCheck className="h-3.5 w-3.5" /> Activos: {stats.active}
          </Chip>
          <Chip tone="neutral">
            <Ban className="h-3.5 w-3.5" /> Inactivos: {stats.inactive}
          </Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          {canCreate && (
            <Button
              onClick={openNew}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          )}
        </>
      }
    >
      {/* SEARCH */}
      <div className="bg-white rounded-xl border shadow p-4 space-y-4">
        <SectionHeader
          icon={<Search className="h-5 w-5 text-slate-700" />}
          title="Búsqueda"
          subtitle="Filtrá por código, razón social, RUC, teléfono, email o ciudad"
        />
        <Input
          placeholder="Buscar proveedores..."
          className="max-w-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* DATAGRID */}
      <div className="bg-white rounded-xl border shadow p-3">
        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 600, width: "100%" }}>
            <DataGrid
              rows={filtered}
              columns={columns}
              loading={loading}
              getRowId={(r) => (r as any).id}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              disableRowSelectionOnClick
              slots={{ toolbar: GridToolbar }}
              slotProps={{
                toolbar: {
                  showQuickFilter: true,
                  quickFilterProps: { debounceMs: 400 },
                } as any,
              }}
              sx={{
                border: "none",
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "#fafafa",
                  borderBottom: "1px solid #eee",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid #f2f2f2",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#fcfcfc",
                },
              }}
            />
          </div>
        </ThemeProvider>
      </div>

      {/* MODAL NUEVO/EDITAR */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {editing && (
              <div>
                <label className="text-sm font-medium">Código</label>
                <Input value={editing.code} disabled />
              </div>
            )}

            {/* Datos básicos */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <label className="text-sm font-medium">Razón Social *</label>
                <Input
                  value={form.razonSocial ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, razonSocial: e.target.value }))}
                />
              </div>

              <div className="col-span-4">
                <label className="text-sm font-medium">RUC *</label>
                <Input
                  value={form.ruc ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, ruc: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="text-sm font-medium">Contacto</label>
                <Input
                  value={form.contacto ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, contacto: e.target.value }))}
                />
              </div>

              <div className="col-span-4">
                <label className="text-sm font-medium">Teléfono</label>
                <Input
                  value={form.telefono ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>

              <div className="col-span-4">
                <label className="text-sm font-medium">Ciudad</label>
                <Input
                  value={form.ciudad ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, ciudad: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={form.email ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div className="col-span-6">
                <label className="text-sm font-medium">Dirección</label>
                <Input
                  value={form.direccion ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
                />
              </div>
            </div>

            {/* Crédito */}
            <div className="border rounded-xl p-4 bg-gray-50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Crédito</h3>
                <span className="text-xs text-gray-500">
                  Aplica a condiciones de pago del proveedor
                </span>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <label className="text-sm font-medium">Término de crédito</label>
                  <Select
                    value={(form.creditTermId ?? "").toString()}
                    onValueChange={(v) => setForm((p) => ({ ...p, creditTermId: v ? Number(v) : null }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {terms.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name} ({t.days} días)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-6">
                  <label className="text-sm font-medium">Límite de crédito (opcional)</label>
                  <Input
                    type="number"
                    value={form.creditLimit ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, creditLimit: toNumOrNull(e.target.value) }))}
                    placeholder="Ej: 5000000"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="allowInstallments"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!form.allowInstallments}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      allowInstallments: e.target.checked,
                      maxInstallments: e.target.checked ? p.maxInstallments : null,
                      defaultInstallments: e.target.checked ? p.defaultInstallments : null,
                    }))
                  }
                />
                <label htmlFor="allowInstallments" className="text-sm font-medium">
                  Permitir pagos en cuotas
                </label>
              </div>

              {form.allowInstallments && (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6">
                    <label className="text-sm font-medium">Máx. cuotas</label>
                    <Input
                      type="number"
                      value={form.maxInstallments ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, maxInstallments: toIntOrNull(e.target.value) }))}
                      placeholder="Ej: 12"
                    />
                  </div>

                  <div className="col-span-6">
                    <label className="text-sm font-medium">Cuotas por defecto</label>
                    <Input
                      type="number"
                      value={form.defaultInstallments ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, defaultInstallments: toIntOrNull(e.target.value) }))
                      }
                      placeholder="Ej: 3"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Estado */}
            <div className="flex items-center gap-3 pt-1">
              <input
                id="isActive"
                type="checkbox"
                className="h-4 w-4"
                checked={!!form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Activo
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setOpenModal(false)} disabled={saving}>
                Cancelar
              </Button>

              <Button
                onClick={save}
                disabled={saving}
                className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
