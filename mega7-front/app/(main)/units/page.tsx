"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, FileDown } from "lucide-react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";

// MUI
import { DataGrid } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

// Exportación
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const muiTheme = createTheme({}, esES);

type UnitOfMeasure = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

export default function UnitsOfMeasurePage() {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // Modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { code: "", name: "", isActive: true },
  });

  // ================= CARGA DE DATOS =================
  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/unitsofmeasure");
      setUnits(res.data);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las unidades de medida", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ================= FILTRADO GLOBAL =================
  const filteredUnits = useMemo(() => {
    const term = search.toLowerCase();
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.code.toLowerCase().includes(term)
    );
  }, [search, units]);

  // ================= EXPORTAR A EXCEL =================
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(units);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unidades");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "UnidadesDeMedida.xlsx");
  };

  // ================= EXPORTAR A CSV ===================
  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(units);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "UnidadesDeMedida.csv");
  };

  // ================= OPEN CREATE & EDIT ===============
  const openCreate = () => {
    setEditing(null);
    reset({ code: "", name: "", isActive: true });
    setOpenModal(true);
  };

  const openEdit = (unit: UnitOfMeasure) => {
    setEditing(unit);
    reset(unit);
    setOpenModal(true);
  };

  // ================= SAVE UNIT ====================
  async function onSubmit(data: any) {
    try {
      if (!data.code || !data.name) {
        Swal.fire("Error", "Código y nombre son obligatorios", "error");
        return;
      }

      if (editing) {
        await api.put(`/unitsofmeasure/${editing.id}`, data);
        Swal.fire("Actualizado", "Unidad de medida actualizada", "success");
      } else {
        await api.post("/unitsofmeasure", data);
        Swal.fire("Creado", "Unidad de medida creada correctamente", "success");
      }
      setOpenModal(false);
      loadData();
    } catch (err) {
      console.error("Error guardando unidad de medida:", err);
      Swal.fire("Error", "No se pudo guardar", "error");
    }
  }

  // ================= DELETE UNIT ==================
  async function deleteUnit(id: number) {
    Swal.fire({
      title: "¿Eliminar?",
      text: "No podrás deshacer esto",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#999",
      confirmButtonText: "Sí, eliminar",
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        await api.delete(`/unitsofmeasure/${id}`);
        Swal.fire("Eliminado", "Unidad de medida eliminada", "success");
        loadData();
      } catch {
        Swal.fire("Error", "No se pudo eliminar", "error");
      }
    });
  }

  const canCreate = usePermission("Units.Create");
  const canEdit = usePermission("Units.Edit");
  const canDelete = usePermission("Units.Delete");

  // ================= DATAGRID ===========================
  const columns = [
    { field: "code", headerName: "Código", width: 120 },
    { field: "name", headerName: "Nombre", flex: 1 },

    {
      field: "isActive",
      headerName: "Estado",
      width: 140,
      renderCell: (params: any) => (
        <span
          className={`px-3 py-1 rounded-md text-white ${
            params.value ? "bg-green-600" : "bg-red-600"
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
      renderCell: (params: any) => (
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(params.row)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-red-100 border-red-300 text-red-600"
              onClick={() => deleteUnit(params.row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const dynamicHeight =
    filteredUnits.length <= 5
      ? 300
      : filteredUnits.length <= 10
      ? 450
      : 600;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Unidades de Medida</h1>

        <div className="flex gap-3">
          <Button onClick={exportExcel} className="bg-green-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button
              onClick={openCreate}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva
            </Button>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <Input
        placeholder="Buscar unidad de medida..."
        className="max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* DATAGRID */}
      <ThemeProvider theme={muiTheme}>
        <div
          className="bg-white rounded-xl shadow p-4 border h-[450px]"
        >
          <DataGrid
            rows={filteredUnits}
            columns={columns}
            loading={loading}
            pageSizeOptions={[5, 10, 20]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            // 👇 Igual que en Categorías: fila verde/roja según isActive
            getRowClassName={(params) =>
              params.row.isActive ? "row-active" : "row-inactive"
            }
            disableRowSelectionOnClick
          />
        </div>
      </ThemeProvider>

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar Unidad de Medida" : "Nueva Unidad de Medida"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Código */}
            <div>
              <label className="text-sm font-medium">Código</label>
              <Input
                {...register("code", { required: true })}
                placeholder="KG, UN, MTS..."
              />
            </div>

            {/* Nombre */}
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...register("name", { required: true })} />
            </div>

            {/* Estado */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Activo</span>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={watch("isActive")}
                  onChange={(e) => setValue("isActive", e.target.checked)}
                />

                <div className="w-11 h-6 bg-gray-300 peer-checked:bg-green-600 rounded-full transition"></div>

                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
              </label>
            </div>

            <Button type="submit" className="w-full bg-[#2563eb] text-white">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
