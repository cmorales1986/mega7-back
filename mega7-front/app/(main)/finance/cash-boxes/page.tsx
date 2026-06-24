"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  RefreshCcw,
  Plus,
  Pencil,
  Trash2,
  Ban,
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  DoorOpen,
  DoorClosed,
  ReceiptText,
} from "lucide-react";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridRenderCellParams,
  GridRowId,
} from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// ===== helpers miles UI
const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
const fmtInput = (s: string) => {
  const d = onlyDigits(s);
  return d ? new Intl.NumberFormat("es-PY").format(Number(d)) : "";
};
const parseMoney = (s: string) => Number(onlyDigits(s) || "0");

// =====================
// UI helpers
// =====================
function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border bg-white p-2 shadow-sm">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {right ? <div className="flex flex-wrap gap-2">{right}</div> : null}
    </div>
  );
}

// =====================
// Types
// =====================
type CashBox = {
  id: number;
  name: string;
  isActive: boolean;
};

type CashCategory = {
  id: number;
  name: string;
  isActive: boolean;
};

type CashMovement = {
  id: number;
  date: string;
  type: "IN" | "OUT" | "TRANSFER" | string;
  amount: number;
  currency: "PYG" | string;
  description: string;
  reference: string;
  isCancelled: boolean;

  category?: { id: number; name: string } | null;

  cashBox?: { id: number; name: string } | null;
  fromCashBox?: { id: number; name: string } | null;
  toCashBox?: { id: number; name: string } | null;
};

type CashSessionRow = {
  id: number;
  date: string;
  cashBoxId: number;
  cashBoxName: string;
  openingBalance: number;
  isClosed: boolean;
  countedCash?: number | null;
  closingBalanceSystem?: number | null;
  difference?: number | null;
  openedAt: string;
  closedAt?: string | null;
  closeNotes?: string | null;
};

type CashBoxBalance = {
  cashBoxId: number;
  cashBoxName: string;
  openingBalance: number;
  movementsNet: number;
  currentBalance: number;
  asOf: string;
  isActive: boolean;
  hasOpenSession: boolean;
  isClosed: boolean;
};

// =====================
// Page
// =====================
export default function CashBoxesPage() {
  const [tab, setTab] = useState<
    "dashboard" | "boxes" | "categories" | "movements" | "sessions"
  >("dashboard");

  const [loading, setLoading] = useState(false);

  const [boxes, setBoxes] = useState<CashBox[]>([]);
  const [categories, setCategories] = useState<CashCategory[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [balances, setBalances] = useState<CashBoxBalance[]>([]);
  const [sessions, setSessions] = useState<CashSessionRow[]>([]);

  // Filters
  const [filterBoxId, setFilterBoxId] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Dashboard date
  const [asOf, setAsOf] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Sessions date
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Dialogs
  const [openBox, setOpenBox] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const [openMovement, setOpenMovement] = useState(false);
  const [openOpenSession, setOpenOpenSession] = useState(false);
  const [openCloseSession, setOpenCloseSession] = useState(false);

  // Forms
  const [boxForm, setBoxForm] = useState<Partial<CashBox>>({
    name: "",
    isActive: true,
  });

  const [categoryForm, setCategoryForm] = useState<Partial<CashCategory>>({
    name: "",
    isActive: true,
  });

  const [movementForm, setMovementForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    type: "OUT",
    cashBoxId: "",
    fromCashBoxId: "",
    toCashBoxId: "",
    amount: "0",
    categoryId: "none", // ✅ FIX: sentinel (no vacío)
    description: "",
    reference: "",
  });

  const [openSessionForm, setOpenSessionForm] = useState<any>({
    cashBoxId: "",
    date: new Date().toISOString().slice(0, 10),
    openingBalance: "0",
  });

  const [closeSessionForm, setCloseSessionForm] = useState<any>({
    cashBoxId: "",
    date: new Date().toISOString().slice(0, 10),
    countedCash: "0",
    notes: "",
  });

  // =====================
  // Loaders
  // =====================
  const loadBasics = async () => {
    const [b, c] = await Promise.all([
      api.get("/cashboxes"),
      api.get("/cashboxes/categories"),
    ]);

    setBoxes((Array.isArray(b.data) ? b.data : []).filter(Boolean) as CashBox[]);
    setCategories(
      (Array.isArray(c.data) ? c.data : []).filter(Boolean) as CashCategory[]
    );
  };

  const loadMovements = async () => {
    const params: any = {};
    if (filterBoxId !== "all") params.cashBoxId = Number(filterBoxId);
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;

    const res = await api.get("/cashboxes/movements", { params });
    let rows = (Array.isArray(res.data) ? res.data : []) as CashMovement[];

    if (filterType !== "all") {
      rows = rows.filter((r) => String(r.type).toUpperCase() === filterType);
    }

    setMovements(rows);
  };

  const loadBalances = async () => {
    const res = await api.get("/cashboxes/balances", {
      params: { asOf },
    });
    setBalances((Array.isArray(res.data) ? res.data : []) as CashBoxBalance[]);
  };

  const loadSessions = async () => {
    const res = await api.get("/cashboxes/sessions", {
      params: { date: sessionDate },
    });
    setSessions((Array.isArray(res.data) ? res.data : []) as CashSessionRow[]);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await loadBasics();
      await Promise.all([loadBalances(), loadSessions()]);
      if (tab === "movements") await loadMovements();
      Swal.fire("OK", "Datos refrescados", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message ?? "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadBasics();
        await Promise.all([loadBalances(), loadSessions()]);
      } catch (e: any) {
        Swal.fire("Error", e?.response?.data ?? e?.message ?? "Error", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBalances().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOf]);

  useEffect(() => {
    loadSessions().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDate]);

  useEffect(() => {
    if (tab === "movements") loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // =====================
  // computed
  // =====================
  const activeBoxes = useMemo(
    () => boxes.filter((b) => b.isActive).length,
    [boxes]
  );

  const boxesOptions = useMemo(
    () =>
      boxes
        .filter((b) => b.isActive)
        .map((b) => ({ id: b.id, label: b.name })),
    [boxes]
  );

  const categoriesOptions = useMemo(
    () =>
      categories
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, label: c.name })),
    [categories]
  );

  const totalCash = useMemo(() => {
    return balances
      .filter((b) => b.isActive)
      .reduce((acc, x) => acc + Number(x.currentBalance ?? 0), 0);
  }, [balances]);

  // =====================
  // Actions: Boxes
  // =====================
  const openCreateBox = () => {
    setBoxForm({ name: "", isActive: true });
    setOpenBox(true);
  };

  const openEditBox = (b: CashBox) => {
    setBoxForm({ ...b });
    setOpenBox(true);
  };

  const saveBox = async () => {
    try {
      if (!boxForm.name?.trim()) {
        Swal.fire("Atención", "El nombre es obligatorio.", "warning");
        return;
      }

      const payload = { name: boxForm.name.trim(), isActive: !!boxForm.isActive };

      if (boxForm.id) await api.put(`/cashboxes/${boxForm.id}`, payload);
      else await api.post(`/cashboxes`, payload);

      setOpenBox(false);
      await loadBasics();
      await loadBalances();
      Swal.fire("OK", "Guardado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  const deleteBox = async (id: number) => {
    const r = await Swal.fire({
      title: "Eliminar caja?",
      text: "Si tiene movimientos/sesiones no te dejará. En ese caso desactívala.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/cashboxes/${id}`);
      await loadBasics();
      await loadBalances();
      Swal.fire("OK", "Eliminada.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  // =====================
  // Actions: Categories
  // =====================
  const openCreateCategory = () => {
    setCategoryForm({ name: "", isActive: true });
    setOpenCategory(true);
  };

  const openEditCategory = (c: CashCategory) => {
    setCategoryForm({ ...c });
    setOpenCategory(true);
  };

  const saveCategory = async () => {
    try {
      if (!categoryForm.name?.trim()) {
        Swal.fire("Atención", "El nombre es obligatorio.", "warning");
        return;
      }

      const payload = {
        name: categoryForm.name.trim(),
        isActive: !!categoryForm.isActive,
      };

      if (categoryForm.id)
        await api.put(`/cashboxes/categories/${categoryForm.id}`, payload);
      else await api.post(`/cashboxes/categories`, payload);

      setOpenCategory(false);
      await loadBasics();
      Swal.fire("OK", "Guardado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  const deleteCategory = async (id: number) => {
    const r = await Swal.fire({
      title: "Eliminar categoría?",
      text: "Si está usada, no te dejará. En ese caso desactívala.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/cashboxes/categories/${id}`);
      await loadBasics();
      Swal.fire("OK", "Eliminada.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  // =====================
  // Actions: Movements
  // =====================
  const openCreateMovement = () => {
    setMovementForm({
      date: new Date().toISOString().slice(0, 10),
      type: "OUT",
      cashBoxId: "",
      fromCashBoxId: "",
      toCashBoxId: "",
      amount: "0",
      categoryId: "none", // ✅ FIX
      description: "",
      reference: "",
    });
    setOpenMovement(true);
  };

  const saveMovement = async () => {
    try {
      const type = String(movementForm.type ?? "OUT").toUpperCase();
      const amount = parseMoney(movementForm.amount ?? "0");

      if (amount <= 0) {
        Swal.fire("Atención", "Monto debe ser > 0.", "warning");
        return;
      }

      const cat = String(movementForm.categoryId ?? "none");

      const payload: any = {
        date: new Date(movementForm.date + "T00:00:00").toISOString(),
        type,
        amount,
        categoryId: cat !== "none" ? Number(cat) : null, // ✅ FIX
        description: (movementForm.description ?? "").trim(),
        reference: (movementForm.reference ?? "").trim(),
      };

      if (type === "IN" || type === "OUT") {
        if (!movementForm.cashBoxId) {
          Swal.fire("Atención", "Seleccioná una caja.", "warning");
          return;
        }
        payload.cashBoxId = Number(movementForm.cashBoxId);
      } else {
        if (!movementForm.fromCashBoxId || !movementForm.toCashBoxId) {
          Swal.fire("Atención", "Seleccioná caja origen y destino.", "warning");
          return;
        }
        if (movementForm.fromCashBoxId === movementForm.toCashBoxId) {
          Swal.fire("Atención", "Origen y destino no pueden ser iguales.", "warning");
          return;
        }
        payload.fromCashBoxId = Number(movementForm.fromCashBoxId);
        payload.toCashBoxId = Number(movementForm.toCashBoxId);
        payload.categoryId = null; // transferencia no lleva categoría
      }

      await api.post("/cashboxes/movements", payload);
      setOpenMovement(false);

      await Promise.all([loadMovements(), loadBalances(), loadSessions()]);
      Swal.fire("OK", "Movimiento registrado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  const cancelMovement = async (id: number) => {
    const r = await Swal.fire({
      title: "Cancelar movimiento?",
      text: "No borra, solo marca cancelado para auditoría.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      // ✅ FIX: enviar objeto reason (no string pelado)
      await api.post(`/cashboxes/movements/${id}/cancel`, {
        reason: "Cancelado manualmente.",
      });

      await Promise.all([loadMovements(), loadBalances(), loadSessions()]);
      Swal.fire("OK", "Cancelado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  // =====================
  // Actions: Sessions
  // =====================
  const openOpenSessionDialog = () => {
    setOpenSessionForm({
      cashBoxId: "",
      date: sessionDate,
      openingBalance: "0",
    });
    setOpenOpenSession(true);
  };

  const openCloseSessionDialog = () => {
    setCloseSessionForm({
      cashBoxId: "",
      date: sessionDate,
      countedCash: "0",
      notes: "",
    });
    setOpenCloseSession(true);
  };

  const openSession = async () => {
    try {
      if (!openSessionForm.cashBoxId) {
        Swal.fire("Atención", "Seleccioná una caja.", "warning");
        return;
      }

      const payload = {
        date: new Date(openSessionForm.date + "T00:00:00").toISOString(),
        openingBalance: parseMoney(openSessionForm.openingBalance ?? "0"),
      };

      await api.post(`/cashboxes/${Number(openSessionForm.cashBoxId)}/open`, payload);
      setOpenOpenSession(false);

      await Promise.all([loadSessions(), loadBalances()]);
      Swal.fire("OK", "Caja abierta.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  const closeSession = async () => {
    try {
      if (!closeSessionForm.cashBoxId) {
        Swal.fire("Atención", "Seleccioná una caja.", "warning");
        return;
      }

      const payload = {
        date: new Date(closeSessionForm.date + "T00:00:00").toISOString(),
        countedCash: parseMoney(closeSessionForm.countedCash ?? "0"),
        notes: (closeSessionForm.notes ?? "").trim(),
      };

      await api.post(`/cashboxes/${Number(closeSessionForm.cashBoxId)}/close`, payload);
      setOpenCloseSession(false);

      await Promise.all([loadSessions(), loadBalances()]);
      Swal.fire("OK", "Caja cerrada.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message, "error");
    }
  };

  // =====================
  // DataGrid columns
  // =====================
  const boxCols: GridColDef<CashBox>[] = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "name", headerName: "Caja", flex: 1, minWidth: 220 },
    {
      field: "isActive",
      headerName: "Activa",
      width: 120,
      valueGetter: (_v, row) => (row?.isActive ? "Sí" : "No"),
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
      renderCell: (p: GridRenderCellParams<CashBox>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => openEditBox(row)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => deleteBox(row.id)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const categoryCols: GridColDef<CashCategory>[] = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "name", headerName: "Categoría", flex: 1, minWidth: 220 },
    {
      field: "isActive",
      headerName: "Activa",
      width: 120,
      valueGetter: (_v, row) => (row?.isActive ? "Sí" : "No"),
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
      renderCell: (p: GridRenderCellParams<CashCategory>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => openEditCategory(row)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => deleteCategory(row.id)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const movementCols: GridColDef<CashMovement>[] = [
    { field: "id", headerName: "ID", width: 80 },
    {
      field: "date",
      headerName: "Fecha",
      width: 130,
      valueGetter: (_v, row) => (row?.date ?? "").slice(0, 10),
    },
    { field: "type", headerName: "Tipo", width: 120 },
    {
      field: "box",
      headerName: "Caja",
      width: 320,
      valueGetter: (_v, row) => {
        const r = row as CashMovement;
        if (r.type === "IN" || r.type === "OUT") return r.cashBox?.name ?? "";
        return `${r.fromCashBox?.name ?? ""} → ${r.toCashBox?.name ?? ""}`;
      },
    },
    {
      field: "category",
      headerName: "Categoría",
      width: 180,
      valueGetter: (_v, row) => row?.category?.name ?? "",
    },
    {
      field: "amount",
      headerName: "Monto (PYG)",
      width: 160,
      valueGetter: (_v, row) => fmtPY.format(Number(row?.amount ?? 0)),
    },
    { field: "description", headerName: "Descripción", flex: 1, minWidth: 220 },
    { field: "reference", headerName: "Referencia", width: 180 },
    {
      field: "actions",
      headerName: "Acciones",
      width: 140,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<CashMovement>) => (
        <div className="w-full h-full flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 bg-white"
            title="Cancelar"
            onClick={() => cancelMovement(p.row.id)}
            disabled={!!p.row.isCancelled}
          >
            <Ban className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const sessionCols: GridColDef<CashSessionRow>[] = [
    { field: "cashBoxName", headerName: "Caja", width: 240 },
    {
      field: "openingBalance",
      headerName: "Apertura",
      width: 150,
      valueGetter: (_v, r) => fmtPY.format(Number(r.openingBalance ?? 0)),
    },
    {
      field: "isClosed",
      headerName: "Estado",
      width: 120,
      valueGetter: (_v, r) => (r.isClosed ? "CERRADA" : "ABIERTA"),
    },
    {
      field: "closingBalanceSystem",
      headerName: "Sistema",
      width: 150,
      valueGetter: (_v, r) =>
        r.closingBalanceSystem == null
          ? ""
          : fmtPY.format(Number(r.closingBalanceSystem)),
    },
    {
      field: "countedCash",
      headerName: "Contado",
      width: 150,
      valueGetter: (_v, r) =>
        r.countedCash == null ? "" : fmtPY.format(Number(r.countedCash)),
    },
    {
      field: "difference",
      headerName: "Dif.",
      width: 140,
      valueGetter: (_v, r) =>
        r.difference == null ? "" : fmtPY.format(Number(r.difference)),
    },
    { field: "closeNotes", headerName: "Notas", flex: 1, minWidth: 220 },
  ];

  // =====================
  // UI
  // =====================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Caja & Caja Chica</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              PYG solamente. Manejá apertura/cierre por día, movimientos (ingresos/egresos)
              y transferencias entre cajas.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Cajas: {boxes.length} (activas {activeBoxes})
              </Chip>
              <Chip tone="neutral">
                <Tags className="h-3.5 w-3.5" />
                Categorías: {categories.length}
              </Chip>
              <Chip tone="ok">
                <ReceiptText className="h-3.5 w-3.5" />
                Total efectivo ({asOf}): {fmtPY.format(Math.round(totalCash))}
              </Chip>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refreshAll}
              disabled={loading}
              className="bg-white"
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList className="w-full justify-start gap-1 rounded-xl border bg-white p-1 shadow-sm">
          <TabsTrigger
            value="dashboard"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Dashboard
          </TabsTrigger>

          <TabsTrigger
            value="boxes"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Cajas
          </TabsTrigger>

          <TabsTrigger
            value="categories"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Categorías
          </TabsTrigger>

          <TabsTrigger
            value="movements"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Movimientos
          </TabsTrigger>

          <TabsTrigger
            value="sessions"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Apertura/Cierre
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<LayoutDashboard className="h-5 w-5 text-purple-600" />}
              title="Saldos del día"
              subtitle="Saldo por caja = Apertura del día + movimientos netos del día."
              right={
                <div className="flex items-end gap-2">
                  <div>
                    <Label>Fecha</Label>
                    <Input
                      className="bg-white"
                      type="date"
                      value={asOf}
                      onChange={(e) => setAsOf(e.target.value)}
                    />
                  </div>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={loadBalances}
                    disabled={loading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" /> Actualizar
                  </Button>
                </div>
              }
            />

            <Separator className="my-4" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {balances.map((b) => (
                <Card
                  key={b.cashBoxId}
                  className="border-slate-200 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm text-muted-foreground">Caja</div>
                      <div className="mt-1 text-lg font-semibold">{b.cashBoxName}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Chip tone={b.hasOpenSession ? "ok" : "warn"}>
                          {b.hasOpenSession ? (
                            <>
                              <DoorOpen className="h-3.5 w-3.5" /> Sesión abierta
                            </>
                          ) : (
                            <>
                              <DoorClosed className="h-3.5 w-3.5" /> Sin sesión
                            </>
                          )}
                        </Chip>
                        <Chip tone="neutral">PYG</Chip>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-white p-2 shadow-sm">
                      <Wallet className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Apertura</div>
                      <div className="mt-1 font-semibold">
                        {fmtPY.format(Math.round(b.openingBalance ?? 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Neto</div>
                      <div className="mt-1 font-semibold">
                        {fmtPY.format(Math.round(b.movementsNet ?? 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Saldo</div>
                      <div className="mt-1 text-lg font-semibold">
                        {fmtPY.format(Math.round(b.currentBalance ?? 0))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Tip: si una caja aparece “Sin sesión”, primero abrila en “Apertura/Cierre”.
            </p>
          </Card>
        </TabsContent>

        {/* CAJAS */}
        <TabsContent value="boxes" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Wallet className="h-5 w-5 text-purple-600" />}
              title="Cajas"
              subtitle="Creá Caja Principal y Caja Chica (PYG)."
              right={
                <Button
                  onClick={openCreateBox}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nueva Caja
                </Button>
              }
            />
            <Separator className="my-4" />
            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={boxes}
                    getRowId={(r: CashBox): GridRowId => r.id}
                    columns={boxCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categories" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Tags className="h-5 w-5 text-purple-600" />}
              title="Categorías"
              subtitle="Electricidad, movilidad, internet, gastos varios, etc."
              right={
                <Button
                  onClick={openCreateCategory}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                </Button>
              }
            />
            <Separator className="my-4" />
            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={categories}
                    getRowId={(r: CashCategory): GridRowId => r.id}
                    columns={categoryCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>

        {/* MOVIMIENTOS */}
        <TabsContent value="movements" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<ArrowLeftRight className="h-5 w-5 text-purple-600" />}
              title="Movimientos"
              subtitle="Ingresos, egresos y transferencias entre cajas (requiere sesión abierta)."
              right={
                <Button
                  onClick={openCreateMovement}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Movimiento
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-end">
                <div className="md:col-span-2">
                  <Label>Caja</Label>
                  <Select value={filterBoxId} onValueChange={setFilterBoxId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">Todas</SelectItem>
                      {boxesOptions.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="IN">IN</SelectItem>
                      <SelectItem value="OUT">OUT</SelectItem>
                      <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Desde</Label>
                  <Input
                    className="bg-white"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Hasta</Label>
                  <Input
                    className="bg-white"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-5 flex justify-end">
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={loadMovements}
                    disabled={loading}
                  >
                    Filtrar
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={movements}
                    getRowId={(r: CashMovement): GridRowId => r.id}
                    columns={movementCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>

        {/* APERTURA/CIERRE */}
        <TabsContent value="sessions" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<DoorOpen className="h-5 w-5 text-purple-600" />}
              title="Apertura / Cierre"
              subtitle="Abrí caja para poder cargar movimientos. Cerrá al final y controlá diferencias."
              right={
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[220px]">
                    <Label>Fecha</Label>
                    <Input
                      className="bg-white"
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={loadSessions}
                    disabled={loading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" /> Ver
                  </Button>
                  <Button
                    onClick={openOpenSessionDialog}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <DoorOpen className="mr-2 h-4 w-4" /> Abrir
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={openCloseSessionDialog}
                    disabled={loading}
                  >
                    <DoorClosed className="mr-2 h-4 w-4" /> Cerrar
                  </Button>
                </div>
              }
            />

            <Separator className="my-4" />

            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={sessions}
                    getRowId={(r: CashSessionRow): GridRowId => r.id}
                    columns={sessionCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================== Dialog: Caja ===================== */}
      <Dialog open={openBox} onOpenChange={setOpenBox}>
        <DialogContent className="sm:max-w-[560px] bg-white">
          <DialogHeader>
            <DialogTitle>{boxForm.id ? "Editar Caja" : "Nueva Caja"}</DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input
                className="bg-white"
                value={boxForm.name ?? ""}
                onChange={(e) => setBoxForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Caja Principal"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!boxForm.isActive}
                onChange={(e) =>
                  setBoxForm((p) => ({ ...p, isActive: e.target.checked }))
                }
              />
              <Label>Activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenBox(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={saveBox}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Dialog: Categoría ===================== */}
      <Dialog open={openCategory} onOpenChange={setOpenCategory}>
        <DialogContent className="sm:max-w-[560px] bg-white">
          <DialogHeader>
            <DialogTitle>
              {categoryForm.id ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input
                className="bg-white"
                value={categoryForm.name ?? ""}
                onChange={(e) =>
                  setCategoryForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Electricidad"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!categoryForm.isActive}
                onChange={(e) =>
                  setCategoryForm((p) => ({ ...p, isActive: e.target.checked }))
                }
              />
              <Label>Activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenCategory(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={saveCategory}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Dialog: Movimiento ===================== */}
      <Dialog open={openMovement} onOpenChange={setOpenMovement}>
        <DialogContent className="sm:max-w-[820px] bg-white">
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento (PYG)</DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Fecha</Label>
              <Input
                className="bg-white"
                type="date"
                value={movementForm.date ?? ""}
                onChange={(e) =>
                  setMovementForm((p: any) => ({ ...p, date: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={movementForm.type ?? "OUT"}
                onValueChange={(v) =>
                  setMovementForm((p: any) => ({
                    ...p,
                    type: v,
                    cashBoxId: "",
                    fromCashBoxId: "",
                    toCashBoxId: "",
                    categoryId: "none", // ✅ FIX
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="IN">Entrada</SelectItem>
                  <SelectItem value="OUT">Salida</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(movementForm.type === "IN" || movementForm.type === "OUT") && (
              <>
                <div className="md:col-span-2">
                  <Label>Caja</Label>
                  <Select
                    value={movementForm.cashBoxId ?? ""}
                    onValueChange={(v) =>
                      setMovementForm((p: any) => ({ ...p, cashBoxId: v }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar caja" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {boxesOptions.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {movementForm.type === "OUT" && (
                  <div className="md:col-span-2">
                    <Label>Categoría (opcional)</Label>
                    <Select
                      value={String(movementForm.categoryId ?? "none")}
                      onValueChange={(v) =>
                        setMovementForm((p: any) => ({ ...p, categoryId: v }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {/* ✅ FIX: NO value="" */}
                        <SelectItem value="none">(Sin categoría)</SelectItem>

                        {categoriesOptions.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {movementForm.type === "TRANSFER" && (
              <>
                <div>
                  <Label>Caja Origen</Label>
                  <Select
                    value={movementForm.fromCashBoxId ?? ""}
                    onValueChange={(v) =>
                      setMovementForm((p: any) => ({ ...p, fromCashBoxId: v }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Origen" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {boxesOptions.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Caja Destino</Label>
                  <Select
                    value={movementForm.toCashBoxId ?? ""}
                    onValueChange={(v) =>
                      setMovementForm((p: any) => ({ ...p, toCashBoxId: v }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Destino" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {boxesOptions.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label>Monto</Label>
              <Input
                className="bg-white"
                value={movementForm.amount ?? "0"}
                onChange={(e) =>
                  setMovementForm((p: any) => ({
                    ...p,
                    amount: fmtInput(e.target.value),
                  }))
                }
              />
            </div>

            <div>
              <Label>Referencia</Label>
              <Input
                className="bg-white"
                value={movementForm.reference ?? ""}
                onChange={(e) =>
                  setMovementForm((p: any) => ({ ...p, reference: e.target.value }))
                }
                placeholder="Nro comprobante"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Descripción</Label>
              <Input
                className="bg-white"
                value={movementForm.description ?? ""}
                onChange={(e) =>
                  setMovementForm((p: any) => ({ ...p, description: e.target.value }))
                }
                placeholder="Detalle"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenMovement(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={saveMovement}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Dialog: Abrir ===================== */}
      <Dialog open={openOpenSession} onOpenChange={setOpenOpenSession}>
        <DialogContent className="sm:max-w-[720px] bg-white">
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Caja</Label>
              <Select
                value={openSessionForm.cashBoxId ?? ""}
                onValueChange={(v) =>
                  setOpenSessionForm((p: any) => ({ ...p, cashBoxId: v }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar caja" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {boxesOptions.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha</Label>
              <Input
                className="bg-white"
                type="date"
                value={openSessionForm.date ?? ""}
                onChange={(e) =>
                  setOpenSessionForm((p: any) => ({ ...p, date: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Saldo inicial (apertura)</Label>
              <Input
                className="bg-white"
                value={openSessionForm.openingBalance ?? "0"}
                onChange={(e) =>
                  setOpenSessionForm((p: any) => ({
                    ...p,
                    openingBalance: fmtInput(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenOpenSession(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={openSession}
            >
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Dialog: Cerrar ===================== */}
      <Dialog open={openCloseSession} onOpenChange={setOpenCloseSession}>
        <DialogContent className="sm:max-w-[760px] bg-white">
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Caja</Label>
              <Select
                value={closeSessionForm.cashBoxId ?? ""}
                onValueChange={(v) =>
                  setCloseSessionForm((p: any) => ({ ...p, cashBoxId: v }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar caja" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {boxesOptions.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha</Label>
              <Input
                className="bg-white"
                type="date"
                value={closeSessionForm.date ?? ""}
                onChange={(e) =>
                  setCloseSessionForm((p: any) => ({ ...p, date: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Contado en físico</Label>
              <Input
                className="bg-white"
                value={closeSessionForm.countedCash ?? "0"}
                onChange={(e) =>
                  setCloseSessionForm((p: any) => ({
                    ...p,
                    countedCash: fmtInput(e.target.value),
                  }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <Label>Notas (opcional)</Label>
              <Input
                className="bg-white"
                value={closeSessionForm.notes ?? ""}
                onChange={(e) =>
                  setCloseSessionForm((p: any) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Ej: faltante por cambio, retiro, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenCloseSession(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={closeSession}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
