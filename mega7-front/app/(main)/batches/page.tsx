"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Swal from "sweetalert2";
import { useForm } from "react-hook-form";

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

import { Pencil, FileDown, RefreshCcw, Boxes } from "lucide-react";

// MUI
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);

type LotSeries = {
  id: number;
  code: string;
  name: string;
  isBatchManaged: boolean;
  isSerialManaged: boolean;
  isActive: boolean;
};

type FormValues = {
  code: string;
  name: string;
  isBatchManaged: boolean;
  isSerialManaged: boolean;
  isActive: boolean;
};

export default function LotSeriesPage() {
  const [items, setItems] = useState<LotSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // MODAL
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<LotSeries | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>(
    {
      defaultValues: {
        code: "",
        name: "",
        isBatchManaged: false,
        isSerialManaged: false,
        isActive: true,
      },
    }
  );

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get("/products/batch-serial");
      setItems(res.data ?? []);
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data ?? "No se pudo cargar información", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ===================== FILTRADO =====================
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return items;
    return items.filter((i) => {
      const code = (i.code ?? "").toLowerCase();
      const name = (i.name ?? "").toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [search, items]);

  // ===================== STATS (chips) =====================
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.isActive).length;
    const batch = items.filter((x) => x.isBatchManaged).length;
    const serial = items.filter((x) => x.isSerialManaged).length;
    return { total, active, batch, serial };
  }, [items]);

  // ===================== EXPORTACIONES =====================
  const exportExcel = () => Swal.fire("Próximamente", "Exportación avanzada", "info");
  const exportCSV = () => Swal.fire("Próximamente", "Exportación avanzada", "info");

  // ===================== EDITAR =====================
  const openEdit = (row: LotSeries) => {
    reset({
      code: row.code,
      name: row.name,
      isBatchManaged: row.isBatchManaged,
      isSerialManaged: row.isSerialManaged,
      isActive: row.isActive,
    });

    setEditing(row);
    setOpenModal(true);
  };

  // ===================== GUARDAR =====================
  async function onSubmit(data: FormValues) {
    if (data.isBatchManaged && data.isSerialManaged) {
      Swal.fire(
        "Error",
        "El producto no puede ser loteable y serializable al mismo tiempo.",
        "error"
      );
      return;
    }

    if (!editing) {
      Swal.fire("Error", "No hay producto seleccionado", "error");
      return;
    }

    const payload = {
      isBatchManaged: !!data.isBatchManaged,
      isSerialManaged: !!data.isSerialManaged,
      isActive: !!data.isActive,
    };

    try {
      await api.put(`/products/${editing.id}/batch-serial`, payload);
      Swal.fire("Actualizado", "Configuración actualizada", "success");
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data ?? "No se pudo guardar";
      Swal.fire("Error", msg, "error");
    }
  }

  // ===================== COLUMNAS DATAGRID =====================
  const columns = [
    { field: "code", headerName: "Código", width: 120 },
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 260 },
    {
      field: "mode",
      headerName: "Modo",
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (params: any) => {
        const r = params.row as LotSeries | undefined;
        if (!r) return <span className="text-gray-500">-</span>;

        const label =
          r.isBatchManaged && !r.isSerialManaged
            ? "Por lote"
            : !r.isBatchManaged && r.isSerialManaged
            ? "Por serie"
            : !r.isBatchManaged && !r.isSerialManaged
            ? "Sin control"
            : "Inválido";

        return <span className="text-sm">{label}</span>;
      },
    },
    {
      field: "isBatchManaged",
      headerName: "Lote",
      width: 100,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => (
        <span className={params.value ? "text-emerald-700" : "text-gray-500"}>
          {params.value ? "Sí" : "No"}
        </span>
      ),
    },
    {
      field: "isSerialManaged",
      headerName: "Serie",
      width: 100,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => (
        <span className={params.value ? "text-emerald-700" : "text-gray-500"}>
          {params.value ? "Sí" : "No"}
        </span>
      ),
    },
    {
      field: "isActive",
      headerName: "Estado",
      width: 140,
      headerAlign: "center",
      align: "center",
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
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params: any) => (
        <Button variant="outline" size="sm" onClick={() => openEdit(params.row)} className="h-9 w-9 p-0">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Boxes className="h-5 w-5" />}
      title="Lotes / Series"
      subtitle="Configurá si un producto se controla por lote, por serie o sin control."
      chips={
        <>
          <Chip>{stats.total} ítems</Chip>
          <Chip tone="ok">{stats.active} activos</Chip>
          <Chip tone="info">{stats.batch} loteables</Chip>
          <Chip tone="info">{stats.serial} serializables</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button onClick={exportExcel} className="bg-green-600 text-white" disabled={loading}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button onClick={exportCSV} className="bg-blue-600 text-white" disabled={loading}>
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>
        </>
      }
    >
      <Card className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <SectionHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Listado"
          subtitle="Buscá por código o nombre y editá el modo de control."
          right={
            <Input
              placeholder="Buscar producto..."
              className="w-[320px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        />

        <ThemeProvider theme={muiTheme}>
          <div className="rounded-xl border bg-white p-2">
            <div className="h-[calc(100vh-320px)] w-full">
              <DataGrid
                rows={filtered}
                columns={columns as any}
                loading={loading}
                getRowId={(row) => row.id}
                pageSizeOptions={[5, 10, 20, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10, page: 0 } },
                }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{ toolbar: { showQuickFilter: false } }}
              />
            </div>
          </div>
        </ThemeProvider>
      </Card>

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing
                ? `Configurar: ${editing.code} - ${editing.name}`
                : "Configurar lote/serie"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="text-sm font-medium">Código</label>
              <Input {...register("code")} disabled />
            </div>

            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...register("name")} disabled />
            </div>

            {/* Lote */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Administrado por lote</span>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={watch("isBatchManaged")}
                  onChange={(e) =>
                    setValue("isBatchManaged", e.target.checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-checked:bg-green-600 rounded-full transition" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
              </label>
            </div>

            {/* Serie */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Administrado por serie</span>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={watch("isSerialManaged")}
                  onChange={(e) =>
                    setValue("isSerialManaged", e.target.checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-checked:bg-green-600 rounded-full transition" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
              </label>
            </div>

            {/* Activo */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Activo</span>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={watch("isActive")}
                  onChange={(e) =>
                    setValue("isActive", e.target.checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-checked:bg-green-600 rounded-full transition" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
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
