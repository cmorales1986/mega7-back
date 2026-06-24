"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Pencil, Trash2, Plus, FileDown, RefreshCcw, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";

// ✅ Premium shell
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";

// MUI DataGrid
import { DataGrid, GridColDef, GridRowId, GridToolbar } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

// Export
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// =================== TYPES ===================
type Brand = { id: number; code?: string; name: string; isActive?: boolean };
type Category = { id: number; code: string; name: string; isActive: boolean };
type SubCategory = { id: number; code?: string; name: string; categoryId: number; isActive?: boolean };
type UnitOfMeasure = { id: number; code?: string; name: string; isActive?: boolean };
type Tax = { id: number; code?: string; name: string; isActive?: boolean };

type Product = {
  id: number;
  code: string;
  name: string;
  barcode?: string | null;

  brandId: number | null;
  categoryId: number | null;
  subCategoryId: number | null;
  unitOfMeasureId: number | null;
  taxId: number | null;

  brand?: Brand | null;
  category?: Category | null;
  subCategory?: SubCategory | null;
  unitOfMeasure?: UnitOfMeasure | null;
  tax?: Tax | null;

  isBatchManaged: boolean;
  isSerialManaged: boolean;

  minimumStock: number;
  price: number;
  cost: number;

  imageUrl?: string | null;
  description?: string | null;
  isActive: boolean;
};

// Form values
type ProductForm = {
  code: string;
  name: string;
  barcode?: string;

  brandId: number | null;
  categoryId: number | null;
  subCategoryId: number | null;
  unitOfMeasureId: number | null;
  taxId: number | null;

  isBatchManaged: boolean;
  isSerialManaged: boolean;

  minimumStock: any;
  price: any;
  cost: any;

  imageUrl?: string;
  description?: string;
  isActive: boolean;
};

const defaultValues: ProductForm = {
  code: "",
  name: "",
  barcode: "",

  brandId: null,
  categoryId: null,
  subCategoryId: null,
  unitOfMeasureId: null,
  taxId: null,

  isBatchManaged: false,
  isSerialManaged: false,

  minimumStock: 0,
  price: 0,
  cost: 0,

  imageUrl: "",
  description: "",
  isActive: true,
};

// ✅ Tipo de fila para DataGrid (evita "never")
type ProductRow = Product & {
  brandName: string;
  categoryName: string;
  subCategoryName: string;
  priceNum: number;
  costNum: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Lookups
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);

  // Subcats por categoría
  const [subcatsByCategory, setSubcatsByCategory] = useState<SubCategory[]>([]);

  const [search, setSearch] = useState("");

  // Modal
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm<ProductForm>({
    defaultValues,
  });

  const wCategoryId = watch("categoryId");
  const wBatch = watch("isBatchManaged");
  const wSerial = watch("isSerialManaged");

  // ====== Formato miles (UI) para Precio y Costo (MODAL) ======
  const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
  const fmtInput = (s: string) => {
    const d = onlyDigits(s);
    if (!d) return "";
    return fmtPY.format(Number(d));
  };

  const [priceUI, setPriceUI] = useState(fmtInput("0"));
  const [costUI, setCostUI] = useState(fmtInput("0"));

  // ========= LOAD DATA =========
  async function loadData() {
    setLoading(true);
    try {
      const [p, b, c, u, t] = await Promise.all([
        api.get("/products"),
        api.get("/brands"),
        api.get("/categories"),
        api.get("/unitsofmeasure"),
        api.get("/taxes"),
      ]);

      setProducts(p.data);
      setBrands(b.data);
      setCategories(c.data);
      setUnits(u.data);
      setTaxes(t.data);
    } catch (err: any) {
      Swal.fire("Error", "No se pudo cargar productos/maestros", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ✅ Cargar subcategorías cuando cambie la categoría
  useEffect(() => {
    const catId = wCategoryId;

    if (!catId) {
      setSubcatsByCategory([]);
      setValue("subCategoryId", null);
      return;
    }

    (async () => {
      try {
        const res = await api.get(`/subcategories/category/${catId}`);
        setSubcatsByCategory(res.data ?? []);
        setValue("subCategoryId", null);
      } catch {
        setSubcatsByCategory([]);
        setValue("subCategoryId", null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wCategoryId]);

  // ========= GLOBAL SEARCH =========
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;

    return products.filter((p) => {
      const brand = (p.brand?.name ?? "").toLowerCase();
      const cat = (p.category?.name ?? "").toLowerCase();
      const sub = (p.subCategory?.name ?? "").toLowerCase();
      const uom = (p.unitOfMeasure?.name ?? "").toLowerCase();
      const tax = (p.tax?.name ?? "").toLowerCase();

      return (
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.code ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        brand.includes(q) ||
        cat.includes(q) ||
        sub.includes(q) ||
        uom.includes(q) ||
        tax.includes(q)
      );
    });
  }, [search, products]);

  // ✅ rows listos para DataGrid
  const rowsForGrid: ProductRow[] = useMemo(() => {
    return filteredProducts.map((p) => ({
      ...p,
      brandName: p.brand?.name ?? "",
      categoryName: p.category?.name ?? "",
      subCategoryName: p.subCategory?.name ?? "",
      priceNum: Number(p.price ?? 0),
      costNum: Number(p.cost ?? 0),
    }));
  }, [filteredProducts]);

  // ========= EXPORT =========
  const exportExcel = () => {
    const data = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      barcode: p.barcode ?? "",
      brand: p.brand?.name ?? "",
      category: p.category?.name ?? "",
      subCategory: p.subCategory?.name ?? "",
      unit: p.unitOfMeasure?.name ?? "",
      tax: p.tax?.name ?? "",
      minimumStock: p.minimumStock ?? 0,
      price: p.price ?? 0,
      cost: p.cost ?? 0,
      batch: p.isBatchManaged ? "Sí" : "No",
      serial: p.isSerialManaged ? "Sí" : "No",
      active: p.isActive ? "Activo" : "Inactivo",
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "Productos.xlsx");
  };

  const exportCSV = () => {
    const data = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      barcode: p.barcode ?? "",
      brand: p.brand?.name ?? "",
      category: p.category?.name ?? "",
      subCategory: p.subCategory?.name ?? "",
      unit: p.unitOfMeasure?.name ?? "",
      tax: p.tax?.name ?? "",
      minimumStock: p.minimumStock ?? 0,
      price: p.price ?? 0,
      cost: p.cost ?? 0,
      batch: p.isBatchManaged ? "Sí" : "No",
      serial: p.isSerialManaged ? "Sí" : "No",
      active: p.isActive ? "Activo" : "Inactivo",
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "Productos.csv");
  };

  // ========= OPEN CREATE / EDIT =========
  const openCreate = () => {
    setEditing(null);
    reset(defaultValues);
    setSubcatsByCategory([]);
    setPriceUI(fmtInput("0"));
    setCostUI(fmtInput("0"));
    setOpenModal(true);
  };

  const openEdit = async (p: Product) => {
    setEditing(p);

    if (p.categoryId) {
      try {
        const res = await api.get(`/subcategories/category/${p.categoryId}`);
        setSubcatsByCategory(res.data ?? []);
      } catch {
        setSubcatsByCategory([]);
      }
    } else {
      setSubcatsByCategory([]);
    }

    reset({
      code: p.code ?? "",
      name: p.name ?? "",
      barcode: p.barcode ?? "",
      brandId: p.brandId ?? null,
      categoryId: p.categoryId ?? null,
      subCategoryId: p.subCategoryId ?? null,
      unitOfMeasureId: p.unitOfMeasureId ?? null,
      taxId: p.taxId ?? null,
      isBatchManaged: !!p.isBatchManaged,
      isSerialManaged: !!p.isSerialManaged,
      minimumStock: p.minimumStock ?? 0,
      price: p.price ?? 0,
      cost: p.cost ?? 0,
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
      isActive: !!p.isActive,
    });

    setPriceUI(fmtInput(String(p.price ?? 0)));
    setCostUI(fmtInput(String(p.cost ?? 0)));
    setOpenModal(true);
  };

  // ========= HELPERS =========
  const getAxiosErrorMsg = (err: any) => {
    const msg = err?.response?.data;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
    return "Ocurrió un error.";
  };

  const validateUI = (data: ProductForm) => {
    if (!data.code?.trim()) return "El código es obligatorio.";
    if (!data.name?.trim()) return "El nombre es obligatorio.";
    if (!data.brandId) return "Debe seleccionar una marca.";
    if (!data.categoryId) return "Debe seleccionar una categoría.";
    if (!data.subCategoryId) return "Debe seleccionar una subcategoría.";
    if (!data.unitOfMeasureId) return "Debe seleccionar una unidad de medida.";
    if (!data.taxId) return "Debe seleccionar un impuesto.";
    if (data.isBatchManaged && data.isSerialManaged)
      return "El producto no puede ser loteable y serializable al mismo tiempo.";
    return null;
  };

  // ========= SAVE =========
  async function onSubmit(form: ProductForm) {
    const validation = validateUI(form);
    if (validation) {
      Swal.fire("Validación", validation, "warning");
      return;
    }

    const payload = {
      ...form,
      minimumStock: Number(form.minimumStock ?? 0),
      price: Number(form.price ?? 0),
      cost: Number(form.cost ?? 0),
      description: form.description ?? "",
    };

    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        Swal.fire("Actualizado", "Producto actualizado", "success");
      } else {
        await api.post("/products", payload);
        Swal.fire("Creado", "Producto creado correctamente", "success");
      }
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire("Error", getAxiosErrorMsg(err), "error");
    }
  }

  // ========= DELETE =========
  async function deleteProduct(id: number) {
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
        await api.delete(`/products/${id}`);
        Swal.fire("Eliminado", "Producto eliminado", "success");
        loadData();
      } catch (err: any) {
        Swal.fire("Error", getAxiosErrorMsg(err), "error");
      }
    });
  }

  const canCreate = usePermission("Products.Create");
  const canEdit = usePermission("Products.Edit");
  const canDelete = usePermission("Products.Delete");

  // ========= DATAGRID COLUMNS =========
  const columns: GridColDef<ProductRow>[] = [
    { field: "code", headerName: "Código", width: 90 },
    { field: "name", headerName: "Nombre", flex: 1, minWidth: 240 },

    { field: "brandName", headerName: "Marca", width: 140 },
    { field: "categoryName", headerName: "Categoría", width: 180 },
    { field: "subCategoryName", headerName: "Subcategoría", width: 200 },

    {
      field: "priceNum",
      headerName: "Precio",
      width: 130,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },
    {
      field: "costNum",
      headerName: "Costo",
      width: 130,
      valueFormatter: (value) => fmtPY.format(Number(value ?? 0)),
    },

    {
      field: "isBatchManaged",
      headerName: "Lote",
      width: 90,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <span
          className={`px-3 py-1 rounded-md text-white ${
            params.value ? "bg-indigo-600" : "bg-gray-400"
          }`}
        >
          {params.value ? "Sí" : "No"}
        </span>
      ),
    },
    {
      field: "isSerialManaged",
      headerName: "Serie",
      width: 90,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <span
          className={`px-3 py-1 rounded-md text-white ${
            params.value ? "bg-purple-600" : "bg-gray-400"
          }`}
        >
          {params.value ? "Sí" : "No"}
        </span>
      ),
    },
    {
      field: "isActive",
      headerName: "Estado",
      width: 120,
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
      width: 170,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <div className="w-full h-full flex items-center justify-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(params.row)}
              className="h-9 w-9 p-0 bg-white"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white hover:bg-red-50 border-red-300 text-red-600"
              onClick={() => deleteProduct(params.row.id)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ========= UI: auto-regla lote/serie =========
  useEffect(() => {
    if (wBatch && wSerial) setValue("isSerialManaged", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wBatch, wSerial]);

  // ========= CHIPS / STATS =========
  const total = products.length;
  const activos = products.filter((x) => x.isActive).length;
  const inactivos = total - activos;
  const loteables = products.filter((x) => x.isBatchManaged).length;
  const serializables = products.filter((x) => x.isSerialManaged).length;

  return (
    <PageShell
      icon={<Package className="h-5 w-5 text-purple-600" />}
      title="Productos"
      subtitle="Gestión de productos, precios/costos y propiedades (lote/serie)."
      chips={
        <>
          <Chip tone="info">Total: {total}</Chip>
          <Chip tone="ok">Activos: {activos}</Chip>
          <Chip tone={inactivos > 0 ? "warn" : "neutral"}>Inactivos: {inactivos}</Chip>
          <Chip tone={loteables > 0 ? "info" : "neutral"}>Loteables: {loteables}</Chip>
          <Chip tone={serializables > 0 ? "info" : "neutral"}>Serializables: {serializables}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={exportExcel}
            variant="outline"
            className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>

          <Button
            onClick={exportCSV}
            variant="outline"
            className="bg-white border-sky-200 text-sky-700 hover:bg-sky-50"
          >
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>

          {canCreate && (
            <Button
              onClick={openCreate}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          )}
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Package className="h-5 w-5 text-purple-600" />}
          title="Listado de productos"
          subtitle="Buscá por código, nombre, barcode, marca, categoría, etc."
        />

        <Separator className="my-4" />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Buscar producto (código, nombre, barcode, marca, categoría...)"
            className="max-w-xl bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div style={{ height: 620, width: "100%" }}>
              <DataGrid
                rows={rowsForGrid}
                columns={columns}
                loading={loading}
                pageSizeOptions={[5, 10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                getRowId={(r: ProductRow): GridRowId => r.id}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
              />
            </div>
          </ThemeProvider>
        </div>
      </Card>

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Row 1 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3">
                <label className="text-sm font-medium">Código</label>
                <Input className="bg-white" {...register("code", { required: true })} />
              </div>

              <div className="col-span-6">
                <label className="text-sm font-medium">Nombre</label>
                <Input className="bg-white" {...register("name", { required: true })} />
              </div>

              <div className="col-span-3">
                <label className="text-sm font-medium">Barcode</label>
                <Input className="bg-white" {...register("barcode")} />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3">
                <label className="text-sm font-medium">Marca</label>
                <select
                  className="w-full h-10 rounded-md border px-3 bg-white"
                  value={watch("brandId") ?? ""}
                  onChange={(e) =>
                    setValue("brandId", e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Seleccionar</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="text-sm font-medium">Categoría</label>
                <select
                  className="w-full h-10 rounded-md border px-3 bg-white"
                  value={watch("categoryId") ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setValue("categoryId", v);
                    setValue("subCategoryId", null);
                  }}
                >
                  <option value="">Seleccionar</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="text-sm font-medium">Subcategoría</label>
                <select
                  className="w-full h-10 rounded-md border px-3 bg-white disabled:bg-gray-100"
                  value={watch("subCategoryId") ?? ""}
                  disabled={!watch("categoryId")}
                  onChange={(e) =>
                    setValue("subCategoryId", e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Seleccionar</option>
                  {subcatsByCategory.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="text-sm font-medium">U. Medida</label>
                <select
                  className="w-full h-10 rounded-md border px-3 bg-white"
                  value={watch("unitOfMeasureId") ?? ""}
                  onChange={(e) =>
                    setValue("unitOfMeasureId", e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Seleccionar</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3">
                <label className="text-sm font-medium">Impuesto</label>
                <select
                  className="w-full h-10 rounded-md border px-3 bg-white"
                  value={watch("taxId") ?? ""}
                  onChange={(e) => setValue("taxId", e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Seleccionar</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="text-sm font-medium">Stock mínimo</label>
                <Input className="bg-white" type="number" {...register("minimumStock")} />
              </div>

              {/* ✅ Precio con miles */}
              <div className="col-span-3">
                <label className="text-sm font-medium">Precio</label>
                <Input
                  className="bg-white"
                  inputMode="numeric"
                  value={priceUI}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const formatted = fmtInput(raw);
                    setPriceUI(formatted);
                    const numeric = Number(onlyDigits(raw) || 0);
                    setValue("price", numeric as any);
                  }}
                />
              </div>

              {/* ✅ Costo con miles */}
              <div className="col-span-3">
                <label className="text-sm font-medium">Costo</label>
                <Input
                  className="bg-white"
                  inputMode="numeric"
                  value={costUI}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const formatted = fmtInput(raw);
                    setCostUI(formatted);
                    const numeric = Number(onlyDigits(raw) || 0);
                    setValue("cost", numeric as any);
                  }}
                />
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <label className="text-sm font-medium">ImageUrl</label>
                <Input className="bg-white" {...register("imageUrl")} />
              </div>
            </div>

            {/* Descripción */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  rows={4}
                  className="bg-white"
                  placeholder="Descripción del producto..."
                  {...register("description")}
                />
              </div>
            </div>

            {/* Switches */}
            <div className="grid grid-cols-12 gap-4 items-center">
              {/* Activo */}
              <div className="col-span-4 flex items-center justify-between">
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

              {/* Lote */}
              <div className="col-span-4 flex items-center justify-between">
                <span className="text-sm font-medium">Loteable</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={watch("isBatchManaged")}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setValue("isBatchManaged", checked);
                      if (checked) setValue("isSerialManaged", false);
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-checked:bg-indigo-600 rounded-full transition"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
                </label>
              </div>

              {/* Serie */}
              <div className="col-span-4 flex items-center justify-between">
                <span className="text-sm font-medium">Serializable</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={watch("isSerialManaged")}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setValue("isSerialManaged", checked);
                      if (checked) setValue("isBatchManaged", false);
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-checked:bg-purple-600 rounded-full transition"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#C5A05A] hover:bg-[#b8934f] text-white">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
