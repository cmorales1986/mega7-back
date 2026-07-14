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

import { RefreshCcw, Plus, Pencil, Trash2, Percent } from "lucide-react";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);

type Tax = {
  id: number;
  name: string;
  rate: number;
};


export default function TaxesPage() {
  const [rows, setRows] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");

  const resetForm = () => {
    setEditing(null);
    setName("");
    setRate("");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<Tax[]>("/taxes");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar impuestos"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) || String(r.id).includes(q)
    );
  }, [rows, search]);

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (row: Tax) => {
    setEditing(row);
    setName(row.name);
    setRate(String(row.rate));
    setOpen(true);
  };

  const validate = (): string | null => {
    if (!name.trim()) return "El nombre es requerido.";
    const r = parseFloat(rate);
    if (isNaN(r) || r < 0) return "La tasa debe ser un número positivo (ej: 10 para 10%).";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return Swal.fire("Validación", err, "warning");

    const payload = { name: name.trim(), rate: parseFloat(rate) };

    try {
      setLoading(true);
      if (!editing) {
        await api.post("/taxes", payload);
        Swal.fire("OK", "Impuesto creado.", "success");
      } else {
        await api.put(`/taxes/${editing.id}`, payload);
        Swal.fire("OK", "Impuesto actualizado.", "success");
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

  const remove = async (row: Tax) => {
    const r = await Swal.fire({
      title: `Eliminar ${row.name}`,
      text: "Esta acción no se puede deshacer. ¿Continuar?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No",
      confirmButtonColor: "#d33",
    });
    if (!r.isConfirmed) return;

    try {
      setLoading(true);
      await api.delete(`/taxes/${row.id}`);
      await loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo eliminar"), "error");
    } finally {
      setLoading(false);
    }
  };

  const canCreate = usePermission("Taxes.Create");
  const canEdit   = usePermission("Taxes.Edit");
  const canDelete = usePermission("Taxes.Delete");

  const cols: GridColDef<Tax>[] = [
    { field: "id",   headerName: "ID",     width: 80 },
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 200 },
    {
      field: "rate",
      headerName: "Tasa (%)",
      width: 130,
      headerAlign: "right",
      align: "right",
      valueFormatter: (v) => `${Number(v ?? 0).toFixed(2)} %`,
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
      renderCell: (p: GridRenderCellParams<Tax>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white" title="Editar" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white" title="Eliminar" onClick={() => remove(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      icon={<Percent className="h-5 w-5 text-purple-600" />}
      title="Impuestos"
      subtitle="Tasas impositivas usadas en facturas y productos (IVA, etc.)."
      chips={
        <>
          <Chip tone="info">Total: {rows.length}</Chip>
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
          icon={<Percent className="h-5 w-5 text-purple-600" />}
          title="Listado de Impuestos"
          subtitle="Buscá por nombre o ID."
        />

        <Separator className="my-4" />

        <Input
          placeholder="Buscar (nombre, id…)"
          className="max-w-xl bg-white mb-4"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div className="h-[calc(100vh-340px)] w-full">
              <DataGrid
                rows={filteredRows}
                columns={cols}
                getRowId={(r: Tax): GridRowId => r.id}
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
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-[420px] bg-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar impuesto" : "Nuevo impuesto"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input className="bg-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="IVA 10%" />
            </div>
            <div className="grid gap-2">
              <Label>Tasa (%)</Label>
              <Input
                className="bg-white"
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-gray-400">Ingresá el porcentaje directamente (ej: 10 = 10%)</p>
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