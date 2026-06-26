"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageShell } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

import { Plus, Pencil, Trash2, RefreshCcw, Users2, UserCheck } from "lucide-react";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtSalary = (s: string) => {
  const d = onlyDigits(s);
  return d ? new Intl.NumberFormat("es-PY").format(Number(d)) : "";
};
const parseSalary = (s: string) => Number(onlyDigits(s) || "0");

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  position?: string | null;
  department?: string | null;
  baseSalary: number;
  hireDate: string;
  terminationDate?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  notes?: string | null;
  isActive: boolean;
};

const emptyForm = (): any => ({
  firstName: "",
  lastName: "",
  documentNumber: "",
  position: "",
  department: "",
  baseSalary: "0",
  hireDate: new Date().toISOString().slice(0, 10),
  terminationDate: "",
  bankName: "",
  bankAccountNumber: "",
  notes: "",
  isActive: true,
});

export default function EmployeesPage() {
  const [rows, setRows]     = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]     = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm]     = useState<any>(emptyForm());

  const canCreate = usePermission("Employees.Create");
  const canEdit   = usePermission("Employees.Edit");
  const canDelete = usePermission("Employees.Delete");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/employees");
      setRows(r.data ?? []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: Employee) => {
    setEditId(row.id);
    setForm({
      firstName:         row.firstName ?? "",
      lastName:          row.lastName ?? "",
      documentNumber:    row.documentNumber ?? "",
      position:          row.position ?? "",
      department:        row.department ?? "",
      baseSalary:        fmtSalary(String(row.baseSalary ?? 0)),
      hireDate:          (row.hireDate ?? "").slice(0, 10),
      terminationDate:   row.terminationDate ? (row.terminationDate).slice(0, 10) : "",
      bankName:          row.bankName ?? "",
      bankAccountNumber: row.bankAccountNumber ?? "",
      notes:             row.notes ?? "",
      isActive:          !!row.isActive,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.firstName.trim()) return Swal.fire("Validación", "El nombre es requerido.", "warning");
    if (!form.lastName.trim())  return Swal.fire("Validación", "El apellido es requerido.", "warning");

    const payload = {
      firstName:         form.firstName.trim(),
      lastName:          form.lastName.trim(),
      documentNumber:    form.documentNumber?.trim() || null,
      position:          form.position?.trim() || null,
      department:        form.department?.trim() || null,
      baseSalary:        parseSalary(form.baseSalary),
      hireDate:          new Date(form.hireDate + "T00:00:00").toISOString(),
      terminationDate:   form.terminationDate ? new Date(form.terminationDate + "T00:00:00").toISOString() : null,
      bankName:          form.bankName?.trim() || null,
      bankAccountNumber: form.bankAccountNumber?.trim() || null,
      notes:             form.notes?.trim() || null,
      isActive:          !!form.isActive,
    };

    setLoading(true);
    try {
      if (editId) await api.put(`/employees/${editId}`, payload);
      else        await api.post("/employees", payload);
      Swal.fire("OK", editId ? "Funcionario actualizado." : "Funcionario creado.", "success");
      setOpen(false);
      await load();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: number, name: string) => {
    const r = await Swal.fire({
      title: `Eliminar a ${name}?`,
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    try {
      await api.delete(`/employees/${id}`);
      await load();
      Swal.fire("OK", "Eliminado.", "success");
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e), "error");
    }
  };

  const columns: GridColDef<Employee>[] = useMemo(() => [
    { field: "id", headerName: "ID", width: 70 },
    {
      field: "fullName",
      headerName: "Nombre",
      flex: 1,
      minWidth: 200,
      valueGetter: (_v, row) => `${row.lastName}, ${row.firstName}`,
    },
    { field: "documentNumber", headerName: "CI", width: 130 },
    { field: "position",   headerName: "Cargo",       width: 160 },
    { field: "department", headerName: "Departamento", width: 160 },
    {
      field: "baseSalary",
      headerName: "Salario Base",
      width: 150,
      valueGetter: (_v, row) => fmtPY.format(Number(row.baseSalary ?? 0)),
    },
    {
      field: "hireDate",
      headerName: "Ingreso",
      width: 120,
      valueGetter: (_v, row) => (row.hireDate ?? "").slice(0, 10),
    },
    {
      field: "isActive",
      headerName: "Activo",
      width: 90,
      valueGetter: (_v, row) => (row.isActive ? "Sí" : "No"),
    },
    {
      field: "actions",
      headerName: "",
      width: 110,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p: GridRenderCellParams<Employee>) => (
        <div className="flex items-center gap-1 h-full">
          {canEdit && (
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white"
              onClick={() => openEdit(p.row)} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" className="h-8 w-8 p-0"
              onClick={() => remove(p.row.id, `${p.row.firstName} ${p.row.lastName}`)} title="Eliminar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ], [canEdit, canDelete]);

  const activeCount = useMemo(() => rows.filter(r => r.isActive).length, [rows]);

  return (
    <PageShell
      icon={<Users2 className="h-6 w-6 text-teal-600" />}
      title="Funcionarios"
      subtitle="Alta, baja y modificación de funcionarios de la empresa."
      right={
        <>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refrescar
          </Button>
          {canCreate && (
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo
            </Button>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<UserCheck className="h-5 w-5 text-teal-600" />}
          title="Listado"
          subtitle={`${rows.length} funcionarios · ${activeCount} activos`}
        />
        <Separator className="my-4" />

        <ThemeProvider theme={muiTheme}>
          <div style={{ height: 580, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={r => r.id}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[15, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              slots={{ toolbar: GridToolbar }}
            />
          </div>
        </ThemeProvider>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 w-[min(95vw,760px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar funcionario" : "Nuevo funcionario"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {/* Datos personales */}
            <div>
              <Label>Nombre <span className="text-red-500">*</span></Label>
              <Input className="bg-white" value={form.firstName}
                onChange={e => setForm((p: any) => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div>
              <Label>Apellido <span className="text-red-500">*</span></Label>
              <Input className="bg-white" value={form.lastName}
                onChange={e => setForm((p: any) => ({ ...p, lastName: e.target.value }))} />
            </div>
            <div>
              <Label>CI / Documento</Label>
              <Input className="bg-white" value={form.documentNumber}
                placeholder="1234567"
                onChange={e => setForm((p: any) => ({ ...p, documentNumber: e.target.value }))} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input className="bg-white" value={form.position}
                placeholder="Ej: Contador"
                onChange={e => setForm((p: any) => ({ ...p, position: e.target.value }))} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input className="bg-white" value={form.department}
                placeholder="Ej: Administración"
                onChange={e => setForm((p: any) => ({ ...p, department: e.target.value }))} />
            </div>
            <div>
              <Label>Salario Base (Gs.)</Label>
              <Input className="bg-white text-right font-mono" value={form.baseSalary}
                onChange={e => setForm((p: any) => ({ ...p, baseSalary: fmtSalary(e.target.value) }))} />
            </div>
            <div>
              <Label>Fecha de ingreso</Label>
              <Input type="date" className="bg-white" value={form.hireDate}
                onChange={e => setForm((p: any) => ({ ...p, hireDate: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha de egreso <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input type="date" className="bg-white" value={form.terminationDate}
                onChange={e => setForm((p: any) => ({ ...p, terminationDate: e.target.value }))} />
            </div>

            {/* Datos bancarios */}
            <div>
              <Label>Banco <span className="text-gray-400 font-normal">(para pago de salario)</span></Label>
              <Input className="bg-white" value={form.bankName}
                placeholder="Ej: Itaú"
                onChange={e => setForm((p: any) => ({ ...p, bankName: e.target.value }))} />
            </div>
            <div>
              <Label>Nro. Cuenta</Label>
              <Input className="bg-white" value={form.bankAccountNumber}
                placeholder="123-456-789"
                onChange={e => setForm((p: any) => ({ ...p, bankAccountNumber: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <Label>Observaciones</Label>
              <Input className="bg-white" value={form.notes}
                onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-teal-600"
                checked={!!form.isActive}
                onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))} />
              <Label>Activo</Label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={save} disabled={loading}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
