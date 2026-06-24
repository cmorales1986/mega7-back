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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, FileDown } from "lucide-react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";

// MUI
import { DataGrid } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const muiTheme = createTheme();

type Category = {
  id: number;
  name: string;
};

type SubCategory = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  categoryId: number;
  categoryName: string; // campo plano para la grilla
  category?: Category;
};

export default function SubCategoriesPage() {
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // MODAL
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<SubCategory | null>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: { name: "", isActive: true, categoryId: 0 },
  });

  // ===================== CARGA DE DATOS =====================
  async function loadData() {
    setLoading(true);
    try {
      // CATEGORÍAS
      const catsRes = await api.get("/categories");
      const catsData = Array.isArray(catsRes.data)
        ? catsRes.data
        : catsRes.data?.data ?? [];

      const catsParsed: Category[] = (catsData as any[]).map((c) => ({
        id: c.id ?? c.Id,
        name: c.name ?? c.Name ?? "",
      }));

      setCategories(catsParsed);

      // SUBCATEGORÍAS
      const subsRes = await api.get("/subcategories");
      const subsData = Array.isArray(subsRes.data)
        ? subsRes.data
        : subsRes.data?.data ?? [];

      const subsParsed: SubCategory[] = (subsData as any[]).map((s) => {
        const cat = s.category ?? s.Category ?? {};
        return {
          id: s.id ?? s.Id,
          code: s.code ?? s.Code ?? "",
          name: s.name ?? s.Name ?? "",
          isActive: s.isActive ?? s.IsActive ?? false,
          categoryId:
            s.categoryId ??
            s.CategoryId ??
            cat.id ??
            cat.Id ??
            0,
          categoryName: cat.name ?? cat.Name ?? "",
          category: {
            id: cat.id ?? cat.Id ?? 0,
            name: cat.name ?? cat.Name ?? "",
          },
        };
      });

      setSubcategories(subsParsed);
    } catch (err) {
      console.error("Error cargando datos de subcategorías:", err);
      Swal.fire("Error", "No se pudo cargar información", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ===================== FILTRADO =====================
  const filtered = useMemo(() => {
    if (!Array.isArray(subcategories)) return [];
    const term = search.toLowerCase();
    return subcategories.filter((s) => {
      const name = s.name ?? "";
      const code = s.code ?? "";
      const catName = s.categoryName ?? "";
      return (
        name.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term) ||
        catName.toLowerCase().includes(term)
      );
    });
  }, [search, subcategories]);

  // ===================== EXPORTACIONES =====================
  const exportExcel = () => {
    Swal.fire("Próximamente", "Exportación avanzada", "info");
  };

  const exportCSV = () => {
    Swal.fire("Próximamente", "Exportación avanzada", "info");
  };

  // ===================== NUEVA SUBCATEGORÍA =====================
  const openCreate = () => {
    const firstCat = categories.length > 0 ? categories[0].id : 0;

    reset({
      name: "",
      isActive: true,
      categoryId: firstCat,
    });

    setEditing(null);
    setOpenModal(true);
  };

  // ===================== EDITAR =====================
  const openEdit = (row: SubCategory) => {
    reset({
      name: row.name,
      isActive: row.isActive,
      categoryId: row.categoryId,
    });

    setEditing(row);
    setOpenModal(true);
  };

  // ===================== GUARDAR =====================
  async function onSubmit(data: any) {
    const payload = {
      name: data.name,
      isActive: data.isActive,
      categoryId: Number(data.categoryId),
    };

    if (!payload.categoryId || payload.categoryId === 0) {
      Swal.fire("Error", "Debe seleccionar una categoría", "error");
      return;
    }

    try {
      if (editing) {
        await api.put(`/subcategories/${editing.id}`, payload);
        Swal.fire("Actualizado", "Subcategoría actualizada", "success");
      } else {
        await api.post("/subcategories", payload);
        Swal.fire("Creada", "Subcategoría creada correctamente", "success");
      }

      setOpenModal(false);
      loadData();
    } catch (err) {
      console.error("Error guardando subcategoría:", err);
      Swal.fire("Error", "No se pudo guardar", "error");
    }
  }

  // ===================== ELIMINAR =====================
  async function deleteRow(id: number) {
    Swal.fire({
      title: "¿Eliminar?",
      text: "No podrás deshacer esta acción",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#999",
      confirmButtonText: "Sí, eliminar",
    }).then(async (res) => {
      if (!res.isConfirmed) return;

      try {
        await api.delete(`/subcategories/${id}`);
        Swal.fire("Eliminado", "Subcategoría eliminada", "success");
        loadData();
      } catch (err) {
        console.error("Error eliminando subcategoría:", err);
        Swal.fire("Error", "No se pudo eliminar", "error");
      }
    });
  }

  const canCreate = usePermission("Subcategories.Create");
  const canEdit = usePermission("Subcategories.Edit");
  const canDelete = usePermission("Subcategories.Delete");

  // ===================== COLUMNAS DATAGRID =====================
  const columns = [
    { field: "code", headerName: "Código", width: 120 },
    { field: "name", headerName: "Nombre", flex: 1 },
    {
      field: "categoryName",
      headerName: "Categoría",
      flex: 1,
    },
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
      width: 150,
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
              onClick={() => deleteRow(params.row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Subcategorías</h1>

        <div className="flex gap-3">
          <Button onClick={exportExcel} className="bg-green-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button onClick={openCreate} className="bg-[#C5A05A] text-white">
              <Plus className="mr-2 h-4 w-4" /> Nueva
            </Button>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      <Input
        placeholder="Buscar subcategoría..."
        className="max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* DATAGRID */}
      <ThemeProvider theme={muiTheme}>
        <div className="bg-white rounded-xl shadow p-4 border h-[450px]">
          <DataGrid
            rows={filtered}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.id}
            pageSizeOptions={[5, 10, 20]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            // 👇 igual que Categorías y Unidades: fila verde/roja
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
              {editing ? "Editar Subcategoría" : "Nueva Subcategoría"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Nombre */}
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...register("name", { required: true })} />
            </div>

            {/* Categoría */}
            <div>
              <label className="text-sm font-medium">Categoría</label>

              <Select
                value={watch("categoryId")?.toString() ?? ""}
                onValueChange={(v) => setValue("categoryId", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una categoría" />
                </SelectTrigger>

                <SelectContent className="bg-white border shadow-xl">
                  {Array.isArray(categories) &&
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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

            <Button type="submit" className="w-full bg-[#C5A05A] text-white">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
