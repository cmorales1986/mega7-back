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

import { RefreshCcw, Plus, Pencil, Trash2, Settings2 } from "lucide-react";

const muiTheme = createTheme({}, esES);

type PaymentConcept = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  requiresBusinessPartner: boolean;
  createdAt?: string | null;
};

const toErrorMessage = (e: any, fallback: string) => {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.title === "string" && typeof data?.detail === "string")
    return `${data.title}\n${data.detail}`;
  if (typeof data?.title === "string") return data.title;
  try { return JSON.stringify(data); } catch { return fallback; }
};

export default function PaymentConceptsPage() {
  const [rows, setRows] = useState<PaymentConcept[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentConcept | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [requiresBp, setRequiresBp] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setCode("");
    setName("");
    setIsActive(true);
    setIsDefault(false);
    setRequiresBp(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/paymentconcepts`, {
        params: { activeOnly: showInactive ? false : true },
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setRows((data.filter(Boolean) as PaymentConcept[]) ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo cargar conceptos"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.code ?? "").toLowerCase().includes(q) ||
        String(r.name ?? "").toLowerCase().includes(q) ||
        String(r.id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: PaymentConcept) => {
    setEditing(row);
    setCode(row.code ?? "");
    setName(row.name ?? "");
    setIsActive(!!row.isActive);
    setIsDefault(!!row.isDefault);
    setRequiresBp(!!row.requiresBusinessPartner);
    setOpen(true);
  };

  const validate = (): string | null => {
    if (!code.trim()) return "Code es requerido.";
    if (!name.trim()) return "Name es requerido.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      isActive,
      isDefault,
      requiresBusinessPartner: requiresBp,
    };

    try {
      setLoading(true);
      if (!editing) {
        await api.post(`/paymentconcepts`, payload);
        Swal.fire("OK", "Concepto creado.", "success");
      } else {
        await api.put(`/paymentconcepts/${editing.id}`, payload);
        Swal.fire("OK", "Concepto actualizado.", "success");
      }
      setOpen(false);
      resetForm();
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo guardar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async (row: PaymentConcept) => {
    const r = await Swal.fire({
      title: `Desactivar ${row.name}`,
      text: "No se eliminará. Quedará inactivo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "No",
    });
    if (!r.isConfirmed) return;

    try {
      setLoading(true);
      await api.post(`/paymentconcepts/${row.id}/deactivate`);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo desactivar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const hardDelete = async (row: PaymentConcept) => {
    const r = await Swal.fire({
      title: `Eliminar ${row.name}`,
      text: "Esto borra el registro (no recomendado).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No",
      confirmButtonColor: "#d33",
    });
    if (!r.isConfirmed) return;

    try {
      setLoading(true);
      await api.delete(`/paymentconcepts/${row.id}`);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMessage(e, "No se pudo eliminar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const canCreate = usePermission("PaymentConcepts.Create");
  const canEdit = usePermission("PaymentConcepts.Edit");
  const canDeactivate = usePermission("PaymentConcepts.Deactivate");

  const cols: GridColDef<PaymentConcept>[] = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "code", headerName: "Código", width: 140 },
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 240 },
    {
      field: "isActive",
      headerName: "Activo",
      width: 120,
      headerAlign: "center",
      align: "center",
      valueGetter: (_v, row) => (row.isActive ? "SI" : "NO"),
    },
    {
      field: "isDefault",
      headerName: "Default",
      width: 120,
      headerAlign: "center",
      align: "center",
      valueGetter: (_v, row) => (row.isDefault ? "SI" : "NO"),
    },
    {
      field: "requiresBusinessPartner",
      headerName: "Req. Proveedor",
      width: 160,
      headerAlign: "center",
      align: "center",
      valueGetter: (_v, row) => (row.requiresBusinessPartner ? "SI" : "NO"),
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
      renderCell: (p: GridRenderCellParams<PaymentConcept>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                title="Editar"
                onClick={() => openEdit(row)}
              >
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

  const total = rows.length;
  const activeCount = rows.filter((x) => x.isActive).length;
  const inactiveCount = rows.filter((x) => !x.isActive).length;
  const defaults = rows.filter((x) => x.isDefault).length;

  return (
    <PageShell
      icon={<Settings2 className="h-5 w-5 text-purple-600" />}
      title="Conceptos de Pago"
      subtitle="Catálogo configurable para pagos sin factura (Sueldos, IPS, Impuestos, etc.)."
      chips={
        <>
          <Chip tone="info">Total: {total}</Chip>
          <Chip tone="ok">Activos: {activeCount}</Chip>
          <Chip tone={inactiveCount > 0 ? "warn" : "neutral"}>Inactivos: {inactiveCount}</Chip>
          <Chip tone={defaults > 0 ? "info" : "neutral"}>Default: {defaults}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          {canCreate && (
            <Button onClick={openNew} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-purple-600" />}
          title="Listado"
          subtitle="Buscá por código o nombre. Podés mostrar inactivos."
        />

        <Separator className="my-4" />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar (código, nombre, id...)"
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
            <div className="h-[calc(100vh-320px)] w-full">
              <DataGrid
                rows={filteredRows}
                columns={cols}
                getRowId={(r: PaymentConcept): GridRowId => r.id}
                loading={loading}
                pageSizeOptions={[5, 10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
              />
            </div>
          </ThemeProvider>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Tip: desactivar es mejor que borrar (mantiene historial y evita errores en reportes).
        </div>
      </Card>

      {/* DIALOG */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-[560px] bg-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar concepto" : "Nuevo concepto"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Código</Label>
                <Input className="bg-white" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUELDOS" />
              </div>

              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input className="bg-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sueldos" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Activo
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input type="checkbox" className="h-4 w-4" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Default (solo uno)
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input type="checkbox" className="h-4 w-4" checked={requiresBp} onChange={(e) => setRequiresBp(e.target.checked)} />
                Requiere proveedor (opcional)
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-white" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={loading} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
