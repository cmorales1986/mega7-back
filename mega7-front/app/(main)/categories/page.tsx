"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { api } from "@/lib/api";
import Swal from "sweetalert2";
import { useForm } from "react-hook-form";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { RefreshCcw, Pencil, Trash2, Plus, FileDown, Tags } from "lucide-react";

// ✅ tus componentes base (ajustá la ruta si cambia)
import { PageShell } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

// Exportación
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toErrorMsg } from "@/lib/api-error";

const muiTheme = createTheme({}, esES);

type Category = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // Modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { name: "", isActive: true },
  });

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar categorías"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // ================= FILTRADO =================
  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return categories;

    return categories.filter((cat) => {
      const name = String(cat.name ?? "").toLowerCase();
      const code = String(cat.code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [search, categories]);

  // ================= MÉTRICAS =================
  const metrics = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((x) => !!x.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [categories]);

  // ================= EXPORT =================
  const exportExcel = () => {
    const data = filteredCategories.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      isActive: x.isActive ? "Activo" : "Inactivo",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Categorias");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "Categorias.xlsx");
  };

  const exportCSV = () => {
    const data = filteredCategories.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      isActive: x.isActive ? "Activo" : "Inactivo",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "Categorias.csv");
  };

  // ================= MODAL =================
  const openCreate = () => {
    setEditing(null);
    reset({ name: "", isActive: true });
    setOpenModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    // OJO: tu form solo tiene name/isActive, así que no le pases todo el objeto
    reset({ name: cat.name ?? "", isActive: !!cat.isActive });
    setOpenModal(true);
  };

  // ================= SAVE =================
  async function onSubmit(data: any) {
    try {
      if (!String(data?.name ?? "").trim()) {
        Swal.fire("Validación", "El nombre es obligatorio", "warning");
        return;
      }

      if (editing) {
        // mantenemos tu endpoint actual
        await api.put(`/categories/${editing.id}`, data);
        Swal.fire("Actualizado", "Categoría actualizada", "success");
      } else {
        await api.post("/categories", data);
        Swal.fire("Creado", "Categoría creada correctamente", "success");
      }

      setOpenModal(false);
      loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar"), "error");
    }
  }

  // ================= DELETE =================
  async function deleteCategory(id: number) {
    const res = await Swal.fire({
      title: "¿Eliminar?",
      text: "No podrás deshacer esto",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#999",
      confirmButtonText: "Sí, eliminar",
    });

    if (!res.isConfirmed) return;

    try {
      await api.delete(`/categories/${id}`);
      Swal.fire("Eliminado", "Categoría eliminada", "success");
      loadData();
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo eliminar"), "error");
    }
  }

  const canCreate = usePermission("Categories.Create");
  const canEdit = usePermission("Categories.Edit");
  const canDelete = usePermission("Categories.Delete");

  // ================= DATAGRID =================
  const columns: GridColDef<Category>[] = [
    { field: "code", headerName: "Código", width: 120 },
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 220 },
    {
      field: "isActive",
      headerName: "Estado",
      width: 140,
      headerAlign: "center",
      align: "center",
      renderCell: (params: GridRenderCellParams<Category, boolean>) => (
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
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: GridRenderCellParams<Category>) => (
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => openEdit(params.row)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-red-100 border-red-300 text-red-600"
              onClick={() => deleteCategory(params.row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Tags className="h-5 w-5" />}
      title="Categorías"
      subtitle="Administración de categorías."
      chips={
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm">
            Total: <b>{metrics.total}</b>
          </span>
          <span className="px-3 py-1 rounded-md bg-green-100 text-green-700 text-sm">
            Activas: <b>{metrics.active}</b>
          </span>
          <span className="px-3 py-1 rounded-md bg-red-100 text-red-700 text-sm">
            Inactivas: <b>{metrics.inactive}</b>
          </span>
        </div>
      }
      right={
        <div className="flex gap-3">
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button onClick={exportExcel} className="bg-green-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button
              onClick={openCreate}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva
            </Button>
          )}
        </div>
      }
    >
      <SectionHeader
        icon={<Tags className="h-5 w-5" />}
        title="Listado"
        subtitle="Buscá por nombre o código."
      />

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar categoría..."
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow border p-4">
          <div className="h-[calc(100vh-260px)] w-full">
            <DataGrid
              rows={filteredCategories}
              columns={columns}
              loading={loading}
              getRowId={(row) => row.id}   // ✅ importante
              pageSizeOptions={[5, 10, 20, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              getRowClassName={(params) =>
                params.row.isActive ? "row-active" : "row-inactive"
              }
              disableRowSelectionOnClick
            />
          </div>
        </div>
      </ThemeProvider>

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...register("name", { required: true })} />
            </div>

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

            <Button type="submit" className="w-full bg-[#C5A05A] text-white">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
