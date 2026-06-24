"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PageShell } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import { useForm } from "react-hook-form";
import { Tag, Plus, RefreshCcw, FileDown, Pencil, Trash2 } from "lucide-react";

// MUI DataGrid
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

// Exportación
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const muiTheme = createTheme({}, esES);

type Brand = {
  id: number;
  name: string;
  isActive: boolean;
};

type BrandForm = {
  name: string;
  isActive: boolean;
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  // Modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm<BrandForm>(
    {
      defaultValues: { name: "", isActive: true },
    }
  );

  // ================= CARGA DE DATOS =================
  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/brands");
      setBrands(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Swal.fire(
        "Error",
        e?.response?.data ?? "No se pudieron cargar las marcas",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // ================= FILTRADO GLOBAL =================
  const filteredBrands = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return brands;

    return brands.filter((b) =>
      String(b.name ?? "")
        .toLowerCase()
        .includes(term)
    );
  }, [search, brands]);

  // ================= CHIPS (metrics) =================
  const metrics = useMemo(() => {
    const total = brands.length;
    const active = brands.filter((x) => !!x.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [brands]);

  // ================= EXPORTAR =================
  const exportExcel = () => {
    const data = filteredBrands.map((b) => ({
      id: b.id,
      name: b.name,
      isActive: b.isActive ? "Activo" : "Inactivo",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marcas");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "Marcas.xlsx");
  };

  const exportCSV = () => {
    const data = filteredBrands.map((b) => ({
      id: b.id,
      name: b.name,
      isActive: b.isActive ? "Activo" : "Inactivo",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "Marcas.csv");
  };

  // ================= OPEN CREATE & EDIT ===============
  const openCreate = () => {
    setEditing(null);
    reset({ name: "", isActive: true });
    setOpenModal(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    reset({ name: brand.name ?? "", isActive: !!brand.isActive });
    setOpenModal(true);
  };

  // ================= SAVE =============================
  async function onSubmit(data: BrandForm) {
    const name = String(data.name ?? "").trim();
    if (!name) {
      Swal.fire("Validación", "El nombre es obligatorio", "warning");
      return;
    }

    try {
      if (editing) {
        await api.put(`/brands/${editing.id}`, { ...data, name });
        Swal.fire("Actualizado", "Marca actualizada", "success");
      } else {
        await api.post("/brands", { ...data, name });
        Swal.fire("Creado", "Marca creada correctamente", "success");
      }
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data ?? "No se pudo guardar la marca";
      Swal.fire("Error", msg, "error");
    }
  }

  // ================= DELETE ===========================
  async function deleteBrand(id: number) {
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
        await api.delete(`/brands/${id}`);
        Swal.fire("Eliminado", "Marca eliminada", "success");
        loadData();
      } catch (e: any) {
        Swal.fire("Error", e?.response?.data ?? "No se pudo eliminar", "error");
      }
    });
  }

  // ================= DATAGRID =========================
  const columns: GridColDef<Brand>[] = [
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 240 },
    {
      field: "isActive",
      headerName: "Estado",
      width: 140,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
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
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <div className="w-full h-full flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEdit(params.row)}
            className="h-9 w-9 p-0"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-red-100 border-red-300 text-red-600"
            onClick={() => deleteBrand(params.row.id)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // altura premium tipo “pantalla” como periods (con scroll interno)
  const gridHeightClass = "h-[calc(100vh-320px)]";

  return (
    <PageShell
      icon={<Tag className="h-5 w-5" />}
      title="Marcas"
      subtitle="Administración de marcas para productos."
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
    >
      {/* SECTION HEADER (con icon + acciones) */}
      <SectionHeader
        icon={<Tag className="h-5 w-5" />}
        title="Listado de Marcas"
        subtitle="Buscá, exportá o creá nuevas marcas."
        right={
          <>
            <Button onClick={loadData} variant="outline" disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>

            <Button onClick={exportExcel} className="bg-green-600 text-white">
              <FileDown className="mr-2 h-4 w-4" /> Excel
            </Button>

            <Button onClick={exportCSV} className="bg-blue-600 text-white">
              <FileDown className="mr-2 h-4 w-4" /> CSV
            </Button>

            <Button
              onClick={openCreate}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva
            </Button>
          </>
        }
      />

      {/* CARD premium */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Buscar marca..."
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="text-sm text-muted-foreground">
            Mostrando <b>{filteredBrands.length}</b> de <b>{brands.length}</b>
          </div>
        </div>

        {/* DATAGRID dentro de contenedor premium */}
        <ThemeProvider theme={muiTheme}>
          <div
            className={`mt-3 rounded-xl border bg-white p-2 ${gridHeightClass}`}
          >
            <DataGrid
              rows={filteredBrands}
              columns={columns}
              loading={loading}
              pageSizeOptions={[5, 10, 20, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
              }}
              getRowId={(row) => row.id}
              getRowClassName={(params) =>
                params.row.isActive ? "row-active" : "row-inactive"
              }
              disableRowSelectionOnClick
            />
          </div>
        </ThemeProvider>
      </div>

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar Marca" : "Nueva Marca"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

            <Button type="submit" className="w-full bg-[#C5A05A] text-white">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
