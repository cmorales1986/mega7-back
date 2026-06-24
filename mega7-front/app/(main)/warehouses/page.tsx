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

const muiTheme = createTheme();

type Warehouse = {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // MODAL
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      code: "",
      name: "",
      address: "",
      phone: "",
      isActive: true,
    },
  });

  // ===================== CARGA DE DATOS =====================
  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/warehouses");
      setWarehouses(res.data);
    } catch (err) {
      console.error("Error cargando almacenes:", err);
      Swal.fire("Error", "No se pudo cargar información", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ===================== FILTRADO =====================
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return warehouses.filter((w) => {
      const code = w.code ?? "";
      const name = w.name ?? "";
      const addr = w.address ?? "";
      return (
        code.toLowerCase().includes(term) ||
        name.toLowerCase().includes(term) ||
        addr.toLowerCase().includes(term)
      );
    });
  }, [search, warehouses]);

  // ===================== EXPORTACIONES =====================
  const exportExcel = () => {
    Swal.fire("Próximamente", "Exportación avanzada", "info");
  };

  const exportCSV = () => {
    Swal.fire("Próximamente", "Exportación avanzada", "info");
  };

  // ===================== NUEVO ALMACÉN =====================
  const openCreate = () => {
    reset({
      code: "",
      name: "",
      address: "",
      phone: "",
      isActive: true,
    });

    setEditing(null);
    setOpenModal(true);
  };

  // ===================== EDITAR =====================
  const openEdit = (row: Warehouse) => {
    reset({
      code: row.code,
      name: row.name,
      address: row.address,
      phone: row.phone,
      isActive: row.isActive,
    });

    setEditing(row);
    setOpenModal(true);
  };

  // ===================== GUARDAR =====================
  async function onSubmit(data: any) {
    const payload = {
      code: data.code,
      name: data.name,
      address: data.address ?? "",
      phone: data.phone ?? "",
      isActive: data.isActive,
    };

    if (!payload.code || !payload.name) {
      Swal.fire("Error", "Código y Nombre son obligatorios", "error");
      return;
    }

    try {
      if (editing) {
        await api.put(`/warehouses/${editing.id}`, payload);
        Swal.fire("Actualizado", "Almacén actualizado", "success");
      } else {
        await api.post("/warehouses", payload);
        Swal.fire("Creado", "Almacén creado correctamente", "success");
      }

      setOpenModal(false);
      loadData();
    } catch (err: any) {
      console.error("Error guardando almacén:", err);
      const msg = err?.response?.data ?? "No se pudo guardar";
      Swal.fire("Error", msg, "error");
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
        await api.delete(`/warehouses/${id}`);
        Swal.fire("Eliminado", "Almacén eliminado", "success");
        loadData();
      } catch (err) {
        console.error("Error eliminando almacén:", err);
        Swal.fire("Error", "No se pudo eliminar", "error");
      }
    });
  }

  const canCreate = usePermission("Warehouses.Create");
  const canEdit = usePermission("Warehouses.Edit");
  const canDelete = usePermission("Warehouses.Delete");

  // ===================== COLUMNAS DATAGRID =====================
  const columns = [
    { field: "code", headerName: "Código", width: 120 },
    { field: "name", headerName: "Nombre", flex: 1 },
    { field: "address", headerName: "Dirección", flex: 1 },
    { field: "phone", headerName: "Teléfono", width: 150 },
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
        <h1 className="text-3xl font-semibold">Almacenes</h1>

        <div className="flex gap-3">
          <Button onClick={exportExcel} className="bg-green-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 text-white">
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button onClick={openCreate} className="bg-[#C5A05A] text-white">
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      <Input
        placeholder="Buscar almacén..."
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
              {editing ? "Editar Almacén" : "Nuevo Almacén"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Código */}
            <div>
              <label className="text-sm font-medium">Código</label>
              <Input {...register("code", { required: true })} />
            </div>

            {/* Nombre */}
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...register("name", { required: true })} />
            </div>

            {/* Dirección */}
            <div>
              <label className="text-sm font-medium">Dirección</label>
              <Input {...register("address")} />
            </div>

            {/* Teléfono */}
            <div>
              <label className="text-sm font-medium">Teléfono</label>
              <Input {...register("phone")} />
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
