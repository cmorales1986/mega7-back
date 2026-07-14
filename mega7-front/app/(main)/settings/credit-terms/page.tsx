"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { RefreshCcw, Plus, Pencil, Trash2, CalendarClock } from "lucide-react";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);

type CreditTerm = {
  id: number;
  name: string;
  days: number;
  isActive: boolean;
  createdAt?: string | null;
};


export default function CreditTermsPage() {
  const [rows, setRows] = useState<CreditTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditTerm | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setDays("");
    setIsActive(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<CreditTerm[]>("/creditterms");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar condiciones de crédito"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredRows = useMemo(() => {
    const all = showInactive ? rows : rows.filter((r) => r.isActive);
    const q = search.toLowerCase().trim();
    if (!q) return all;
    return all.filter((r) =>
      r.name.toLowerCase().includes(q) || String(r.days).includes(q) || String(r.id).includes(q)
    );
  }, [rows, search, showInactive]);

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (row: CreditTerm) => {
    setEditing(row);
    setName(row.name);
    setDays(String(row.days));
    setIsActive(row.isActive);
    setOpen(true);
  };

  const validate = (): string | null => {
    if (!name.trim()) return "El nombre es requerido.";
    const d = parseInt(days, 10);
    if (isNaN(d) || d < 0) return "Los días deben ser un número entero positivo (0 = contado).";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    const payload = { name: name.trim(), days: parseInt(days, 10), isActive };

    try {
      setLoading(true);
      if (!editing) {
        await api.post("/creditterms", payload);
        Swal.fire("OK", "Condición de crédito creada.", "success");
      } else {
        await api.put(`/creditterms/${editing.id}`, payload);
        Swal.fire("OK", "Condición de crédito actualizada.", "success");
      }
      setOpen(false);
      resetForm();
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async (row: CreditTerm) => {
    const r = await Swal.fire({
      title: `Desactivar "${row.name}"`,
      text: "Quedará inactiva. No se eliminará.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "No",
    });
    if (!r.isConfirmed) return;

    try {
      setLoading(true);
      await api.delete(`/creditterms/${row.id}`);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo desactivar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const canCreate   = usePermission("CreditTerms.Create");
  const canEdit     = usePermission("CreditTerms.Edit");
  const canDeactivate = usePermission("CreditTerms.Delete");

  const cols: GridColDef<CreditTerm>[] = [
    { field: "id",   headerName: "ID",     width: 80 },
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 200 },
    {
      field: "days",
      headerName: "Días",
      width: 110,
      headerAlign: "right",
      align: "right",
      renderCell: (p: GridRenderCellParams<CreditTerm>) =>
        p.row.days === 0 ? (
          <span className="text-emerald-700 font-semibold">Contado</span>
        ) : (
          <span>{p.row.days} días</span>
        ),
    },
    {
      field: "isActive",
      headerName: "Estado",
      width: 120,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<CreditTerm>) =>
        p.row.isActive ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Activo</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">Inactivo</span>
        ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 140,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<CreditTerm>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white" title="Editar" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDeactivate && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                title="Desactivar"
                onClick={() => deactivate(row)}
                disabled={!row.isActive}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const activeCount   = rows.filter((r) => r.isActive).length;
  const inactiveCount = rows.filter((r) => !r.isActive).length;

  return (
    <PageShell
      icon={<CalendarClock className="h-5 w-5 text-purple-600" />}
      title="Condiciones de Crédito"
      subtitle="Plazos de pago disponibles para clientes (Contado, 30 días, 60 días, etc.)."
      chips={
        <>
          <Chip tone="info">Total: {rows.length}</Chip>
          <Chip tone="ok">Activos: {activeCount}</Chip>
          <Chip tone={inactiveCount > 0 ? "warn" : "neutral"}>Inactivos: {inactiveCount}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          {canCreate && (
            <Button onClick={openNew} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow">
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<CalendarClock className="h-5 w-5 text-purple-600" />}
          title="Listado"
          subtitle="Buscá por nombre, días o ID. Podés mostrar inactivos."
        />

        <Separator className="my-4" />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar (nombre, días, id…)"
            className="max-w-xl bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              id="showInactive"
              type="checkbox"
              className="h-4 w-4"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <label htmlFor="showInactive" className="text-sm text-gray-700 select-none">
              Ver inactivos
            </label>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-360px)] w-full">
              <DataGrid
                rows={filteredRows}
                columns={cols}
                getRowId={(r: CreditTerm): GridRowId => r.id}
                loading={loading}
                pageSizeOptions={[10, 25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
              />
            </div>
          </ThemeProvider>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Tip: desactivar es mejor que borrar — evita errores en documentos existentes.
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-[420px] bg-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar condición" : "Nueva condición de crédito"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input className="bg-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="30 días" />
            </div>
            <div className="grid gap-2">
              <Label>Días de plazo</Label>
              <Input
                className="bg-white"
                type="number"
                min="0"
                step="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-gray-400">0 = Contado. Debe ser único por cantidad de días.</p>
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Activo
              </label>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-white" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={loading} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}