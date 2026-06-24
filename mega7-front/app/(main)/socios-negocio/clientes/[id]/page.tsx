"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Search,
} from "lucide-react";

// ✅ componentes base
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

const muiTheme = createTheme({}, esES);

type SocioNegocio = {
  id: number;
  partnerType: string;
  code: string;
  razonSocial: string;
  ruc: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  isActive: boolean;
};

type SocioNegocioSucursal = {
  id: number;
  socioNegocioId: number;
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  contacto?: string | null;
  isActive: boolean;
};

const emptySucursal = (socioId: number): Partial<SocioNegocioSucursal> => ({
  socioNegocioId: socioId,
  nombre: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  contacto: "",
  isActive: true,
});

export default function ClienteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const socioId = Number((params as any)?.id);

  const [socio, setSocio] = useState<SocioNegocio | null>(null);
  const [sucursales, setSucursales] = useState<SocioNegocioSucursal[]>([]);
  const [loadingSocio, setLoadingSocio] = useState(true);
  const [loadingSuc, setLoadingSuc] = useState(true);

  const [search, setSearch] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SocioNegocioSucursal | null>(null);
  const [form, setForm] = useState<Partial<SocioNegocioSucursal>>(emptySucursal(socioId));

  async function loadSocio() {
    setLoadingSocio(true);
    try {
      const res = await api.get(`/sociosnegocio/${socioId}`);
      setSocio(res.data ?? null);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar el cliente", "error");
    }
    setLoadingSocio(false);
  }

  async function loadSucursales() {
    setLoadingSuc(true);
    try {
      const res = await api.get(`/socionegociosucursales/socio/${socioId}`);
      setSucursales(res.data ?? []);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo cargar sucursales", "error");
    }
    setLoadingSuc(false);
  }

  async function refreshAll() {
    await Promise.all([loadSocio(), loadSucursales()]);
  }

  useEffect(() => {
    if (!socioId) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socioId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sucursales;

    return sucursales.filter((s) => {
      const hay = `${s.nombre} ${s.ciudad ?? ""} ${s.direccion ?? ""} ${s.telefono ?? ""} ${
        s.contacto ?? ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [sucursales, search]);

  const stats = useMemo(() => {
    const total = sucursales.length;
    const active = sucursales.filter((x) => x.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [sucursales]);

  const openNew = () => {
    setEditing(null);
    setForm(emptySucursal(socioId));
    setOpenModal(true);
  };

  const openEdit = (row: SocioNegocioSucursal) => {
    setEditing(row);
    setForm({ ...row });
    setOpenModal(true);
  };

  const validate = (): string | null => {
    const nombre = (form.nombre ?? "").trim();
    if (!nombre) return "Nombre es obligatorio.";
    return null;
  };

  async function saveSucursal() {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    setSaving(true);
    try {
      const payload = {
        socioNegocioId: socioId,
        nombre: (form.nombre ?? "").trim(),
        direccion: form.direccion?.trim() || null,
        ciudad: form.ciudad?.trim() || null,
        telefono: form.telefono?.trim() || null,
        contacto: form.contacto?.trim() || null,
        isActive: form.isActive ?? true,
      };

      if (!editing) {
        await api.post("/socionegociosucursales", payload);
        Swal.fire("OK", "Sucursal creada.", "success");
      } else {
        await api.put(`/socionegociosucursales/${editing.id}`, { id: editing.id, ...payload });
        Swal.fire("OK", "Sucursal actualizada.", "success");
      }

      setOpenModal(false);
      await loadSucursales();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo guardar sucursal.", "error");
    }
    setSaving(false);
  }

  async function removeSucursal(row: SocioNegocioSucursal) {
    const r = await Swal.fire({
      title: "Eliminar sucursal",
      text: `¿Eliminar "${row.nombre}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!r.isConfirmed) return;

    try {
      await api.delete(`/socionegociosucursales/${row.id}`);
      await loadSucursales();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? "No se pudo eliminar.", "error");
    }
  }

  const columns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre", flex: 1, minWidth: 240 },
    { field: "ciudad", headerName: "Ciudad", width: 170 },
    { field: "direccion", headerName: "Dirección", width: 300 },
    { field: "telefono", headerName: "Teléfono", width: 150 },
    { field: "contacto", headerName: "Contacto", width: 200 },
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
      width: 160,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => {
        const row: SocioNegocioSucursal = params.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => openEdit(row)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-red-50 border-red-300 text-red-600"
              onClick={() => removeSucursal(row)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      icon={<Building2 className="h-5 w-5 text-slate-700" />}
      title={loadingSocio ? "Cliente" : socio?.razonSocial ?? "Cliente"}
      subtitle={socio ? `${socio.code} • RUC: ${socio.ruc}` : "Detalle del cliente y sucursales"}
      chips={
        <>
          <Chip tone="neutral">Sucursales: {stats.total}</Chip>
          <Chip tone="ok">Activas: {stats.active}</Chip>
          <Chip tone="neutral">Inactivas: {stats.inactive}</Chip>
        </>
      }
      right={
        <>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>

          <Button onClick={refreshAll} variant="outline" disabled={loadingSocio || loadingSuc}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={openNew}
            className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            disabled={loadingSocio || loadingSuc}
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva sucursal
          </Button>
        </>
      }
    >
      {/* INFO CLIENTE */}
      <div className="bg-white rounded-xl border shadow p-4 space-y-4">
        <SectionHeader
          icon={<User className="h-5 w-5 text-slate-700" />}
          title="Información del cliente"
          subtitle="Datos principales de contacto"
        />

        {!socio ? (
          <div className="text-sm text-muted-foreground">
            {loadingSocio ? "Cargando..." : "No se encontró el cliente."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <User className="h-4 w-4" /> Contacto
              </div>
              <div className="mt-1 font-medium">{socio.contacto || "-"}</div>
            </div>

            <div className="md:col-span-4 rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Phone className="h-4 w-4" /> Teléfono
              </div>
              <div className="mt-1 font-medium">{socio.telefono || "-"}</div>
            </div>

            <div className="md:col-span-4 rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Mail className="h-4 w-4" /> Email
              </div>
              <div className="mt-1 font-medium break-words">{socio.email || "-"}</div>
            </div>

            <div className="md:col-span-8 rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="h-4 w-4" /> Dirección
              </div>
              <div className="mt-1 font-medium">{socio.direccion || "-"}</div>
            </div>

            <div className="md:col-span-4 rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="h-4 w-4" /> Ciudad
              </div>
              <div className="mt-1 font-medium">{socio.ciudad || "-"}</div>
            </div>
          </div>
        )}
      </div>

      {/* BUSQUEDA */}
      <div className="bg-white rounded-xl border shadow p-4 space-y-4">
        <SectionHeader
          icon={<Search className="h-5 w-5 text-slate-700" />}
          title="Sucursales"
          subtitle="Buscá por nombre, ciudad, dirección, teléfono o contacto"
        />

        <Input
          placeholder="Buscar sucursales..."
          className="max-w-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* GRID */}
      <div className="bg-white rounded-xl border shadow p-3">
        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 600, width: "100%" }}>
            <DataGrid
              rows={filtered}
              columns={columns}
              loading={loadingSuc}
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

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar sucursal" : "Nueva sucursal"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={form.nombre ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="text-sm font-medium">Ciudad</label>
                <Input
                  value={form.ciudad ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, ciudad: e.target.value }))}
                />
              </div>
              <div className="col-span-6">
                <label className="text-sm font-medium">Teléfono</label>
                <Input
                  value={form.telefono ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="text-sm font-medium">Contacto</label>
                <Input
                  value={form.contacto ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, contacto: e.target.value }))}
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

            <div className="flex items-center gap-3 pt-2">
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
                onClick={saveSucursal}
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
