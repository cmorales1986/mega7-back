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
  Landmark,
  CreditCard,
  ArrowLeftRight,
  Wallet,
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
// UI helpers (mismo estilo)
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
type Bank = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type BankAccount = {
  id: number;
  bankId: number;
  bank?: Bank;
  accountNumber: string;
  alias: string;
  currency: string;
  initialBalance: number;
  initialBalanceDate: string; // ISO
  isActive: boolean;
};

type BankMovement = {
  id: number;
  date: string;
  type: "IN" | "OUT" | "TRANSFER" | string;

  accountId?: number | null;
  account?: BankAccount | null;

  fromAccountId?: number | null;
  fromAccount?: BankAccount | null;

  toAccountId?: number | null;
  toAccount?: BankAccount | null;

  amount: number;
  currency: string;
  description: string;
  reference: string;
  isCancelled: boolean;
};

type BankAccountBalance = {
  accountId: number;
  bankId: number;
  bankName: string;
  alias: string;
  currency: string;
  initialBalance: number;
  movementsNet: number;
  currentBalance: number;
  asOf: string;
  isActive: boolean;
};

// =====================
// Page
// =====================
export default function BanksPage() {
  const [tab, setTab] = useState<"banks" | "accounts" | "movements">("banks");
  const [loading, setLoading] = useState(false);

  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [balances, setBalances] = useState<BankAccountBalance[]>([]);

  // Filters movimientos
  const [filterAccountId, setFilterAccountId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Dialog states
  const [openBank, setOpenBank] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [openMovement, setOpenMovement] = useState(false);

  // Forms
  const [bankForm, setBankForm] = useState<Partial<Bank>>({
    code: "",
    name: "",
    isActive: true,
  });

  const [accountForm, setAccountForm] = useState<any>({
    bankId: "",
    accountNumber: "",
    alias: "",
    currency: "PYG",
    initialBalance: "0",
    initialBalanceDate: new Date().toISOString().slice(0, 10),
    isActive: true,
  });

  const [movementForm, setMovementForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    type: "IN",
    accountId: "",
    fromAccountId: "",
    toAccountId: "",
    amount: "0",
    description: "",
    reference: "",
  });

  // =====================
  // Loaders
  // =====================
  const loadAll = async () => {
    setLoading(true);
    try {
      const [b, a, bal] = await Promise.all([
        api.get("/banks"),
        api.get("/banks/accounts"),
        api.get("/banks/accounts/balances"),
      ]);

      setBanks((Array.isArray(b.data) ? b.data : []).filter(Boolean) as Bank[]);
      setAccounts(
        (Array.isArray(a.data) ? a.data : []).filter(Boolean) as BankAccount[]
      );
      setBalances(
        (Array.isArray(bal.data) ? bal.data : []).filter(Boolean) as BankAccountBalance[]
      );
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    const res = await api.get("/banks/accounts/balances");
    setBalances(
      (Array.isArray(res.data) ? res.data : []).filter(Boolean) as BankAccountBalance[]
    );
  };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterAccountId !== "all") params.accountId = Number(filterAccountId);
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await api.get("/banks/movements", { params });
      setMovements(
        (Array.isArray(res.data) ? res.data : []).filter(Boolean) as BankMovement[]
      );
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await loadAll();
      if (tab === "movements") await loadMovements();
      Swal.fire("OK", "Datos refrescados", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo refrescar", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadAll();
      } catch (e: any) {
        Swal.fire("Error", e?.message ?? "No se pudo cargar", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "movements") loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // =====================
  // computed
  // =====================
  const accountsOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive)
        .map((a) => ({
          id: a.id,
          label: `${a.bank?.name ?? ""} - ${a.alias} (${a.currency})`,
          currency: a.currency,
        })),
    [accounts]
  );

  const balancesMap = useMemo(() => {
    const m = new Map<number, BankAccountBalance>();
    for (const b of balances) m.set(b.accountId, b);
    return m;
  }, [balances]);

  const totalsCurrent = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of balances.filter((x) => x.isActive)) {
      map.set(
        b.currency,
        (map.get(b.currency) ?? 0) + Number(b.currentBalance ?? 0)
      );
    }
    return Array.from(map.entries()).map(([currency, total]) => ({
      currency,
      total,
    }));
  }, [balances]);

  const movementsCount = useMemo(() => movements.length, [movements]);

  // =====================
  // Actions: BANK
  // =====================
  const openCreateBank = () => {
    setBankForm({ code: "", name: "", isActive: true });
    setOpenBank(true);
  };

  const openEditBank = (b: Bank) => {
    setBankForm({ ...b });
    setOpenBank(true);
  };

  const saveBank = async () => {
    try {
      if (!bankForm.name?.trim()) {
        Swal.fire("Atención", "El nombre del banco es obligatorio.", "warning");
        return;
      }

      const payload = {
        code: (bankForm.code ?? "").trim(),
        name: (bankForm.name ?? "").trim(),
        isActive: !!bankForm.isActive,
      };

      if (bankForm.id) {
        await api.put(`/banks/${bankForm.id}`, payload);
      } else {
        await api.post(`/banks`, payload);
      }

      setOpenBank(false);
      await loadAll();
      Swal.fire("OK", "Guardado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const deleteBank = async (id: number) => {
    const r = await Swal.fire({
      title: "Eliminar banco?",
      text: "Si tiene cuentas, no te dejará. En ese caso desactivalo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/banks/${id}`);
      await loadAll();
      Swal.fire("OK", "Eliminado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  // =====================
  // Actions: ACCOUNT
  // =====================
  const openCreateAccount = () => {
    setAccountForm({
      bankId: "",
      accountNumber: "",
      alias: "",
      currency: "PYG",
      initialBalance: "0",
      initialBalanceDate: new Date().toISOString().slice(0, 10),
      isActive: true,
    });
    setOpenAccount(true);
  };

  const openEditAccount = (a: BankAccount) => {
    setAccountForm({
      id: a.id,
      bankId: String(a.bankId),
      accountNumber: a.accountNumber ?? "",
      alias: a.alias ?? "",
      currency: a.currency ?? "PYG",
      initialBalance: fmtInput(String(a.initialBalance ?? 0)),
      initialBalanceDate: (a.initialBalanceDate ?? "").slice(0, 10),
      isActive: !!a.isActive,
    });
    setOpenAccount(true);
  };

  const saveAccount = async () => {
    try {
      if (!accountForm.bankId) {
        Swal.fire("Atención", "Seleccioná un banco.", "warning");
        return;
      }
      if (!accountForm.alias?.trim()) {
        Swal.fire("Atención", "El alias es obligatorio.", "warning");
        return;
      }
      if (!accountForm.currency?.trim()) {
        Swal.fire("Atención", "La moneda es obligatoria.", "warning");
        return;
      }

      const payload = {
        bankId: Number(accountForm.bankId),
        accountNumber: (accountForm.accountNumber ?? "").trim(),
        alias: (accountForm.alias ?? "").trim(),
        currency: String(accountForm.currency).trim().toUpperCase(),
        initialBalance: parseMoney(accountForm.initialBalance ?? "0"),
        initialBalanceDate: accountForm.initialBalanceDate,
        isActive: !!accountForm.isActive,
      };

      if (accountForm.id) {
        await api.put(`/banks/accounts/${accountForm.id}`, payload);
      } else {
        await api.post(`/banks/accounts`, payload);
      }

      setOpenAccount(false);
      await loadAll();
      Swal.fire("OK", "Cuenta guardada.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const deleteAccount = async (id: number) => {
    const r = await Swal.fire({
      title: "Eliminar cuenta?",
      text: "Si tiene movimientos, no te dejará. En ese caso desactívala.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/banks/accounts/${id}`);
      await loadAll();
      Swal.fire("OK", "Eliminada.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  // =====================
  // Actions: MOVEMENT
  // =====================
  const openCreateMovement = () => {
    setMovementForm({
      date: new Date().toISOString().slice(0, 10),
      type: "IN",
      accountId: "",
      fromAccountId: "",
      toAccountId: "",
      amount: "0",
      description: "",
      reference: "",
    });
    setOpenMovement(true);
  };

  const saveMovement = async () => {
    try {
      const type = String(movementForm.type ?? "IN").toUpperCase();
      const amount = parseMoney(movementForm.amount ?? "0");

      if (amount <= 0) {
        Swal.fire("Atención", "El monto debe ser mayor a 0.", "warning");
        return;
      }

      const payload: any = {
        date: new Date(movementForm.date + "T00:00:00").toISOString(),
        type,
        amount,
        description: (movementForm.description ?? "").trim(),
        reference: (movementForm.reference ?? "").trim(),
      };

      if (type === "IN" || type === "OUT") {
        if (!movementForm.accountId) {
          Swal.fire("Atención", "Seleccioná una cuenta.", "warning");
          return;
        }
        payload.accountId = Number(movementForm.accountId);
      } else {
        if (!movementForm.fromAccountId || !movementForm.toAccountId) {
          Swal.fire("Atención", "Seleccioná cuenta origen y destino.", "warning");
          return;
        }
        if (movementForm.fromAccountId === movementForm.toAccountId) {
          Swal.fire(
            "Atención",
            "Origen y destino no pueden ser iguales.",
            "warning"
          );
          return;
        }
        payload.fromAccountId = Number(movementForm.fromAccountId);
        payload.toAccountId = Number(movementForm.toAccountId);
      }

      await api.post("/banks/movements", payload);
      setOpenMovement(false);
      await loadMovements();
      await loadBalances();
      Swal.fire("OK", "Movimiento registrado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
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
      await api.post(`/banks/movements/${id}/cancel`);
      await loadMovements();
      await loadBalances();
      Swal.fire("OK", "Cancelado.", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  // =====================
  // DataGrid columns (TIPADAS)
  // =====================
  const bankCols: GridColDef<Bank>[] = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "code", headerName: "Código", width: 140 },
    { field: "name", headerName: "Banco", flex: 1, minWidth: 220 },
    {
      field: "isActive",
      headerName: "Activo",
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
      renderCell: (p: GridRenderCellParams<Bank>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => openEditBank(row)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => deleteBank(row.id)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const accountCols: GridColDef<BankAccount>[] = [
    { field: "id", headerName: "ID", width: 80 },
    {
      field: "bankName",
      headerName: "Banco",
      width: 200,
      valueGetter: (_v, row) => row?.bank?.name ?? "",
    },
    { field: "alias", headerName: "Alias", width: 220 },
    { field: "currency", headerName: "Moneda", width: 110 },
    { field: "accountNumber", headerName: "Nro Cuenta", width: 200 },
    {
      field: "initialBalance",
      headerName: "Saldo Inicial",
      width: 160,
      valueGetter: (_v, row) => fmtPY.format(Number(row?.initialBalance ?? 0)),
    },
    {
      field: "currentBalance",
      headerName: "Saldo Actual",
      width: 160,
      valueGetter: (_v, row) => {
        const b = balancesMap.get(row.id);
        return fmtPY.format(
          Number(b?.currentBalance ?? row?.initialBalance ?? 0)
        );
      },
    },
    {
      field: "initialBalanceDate",
      headerName: "Fecha Saldo Inicial",
      width: 170,
      valueGetter: (_v, row) => (row?.initialBalanceDate ?? "").slice(0, 10),
    },
    {
      field: "isActive",
      headerName: "Activo",
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
      renderCell: (p: GridRenderCellParams<BankAccount>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => openEditAccount(row)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => deleteAccount(row.id)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const movementCols: GridColDef<BankMovement>[] = [
    { field: "id", headerName: "ID", width: 80 },
    {
      field: "date",
      headerName: "Fecha",
      width: 130,
      valueGetter: (_v, row) => (row?.date ?? "").slice(0, 10),
    },
    { field: "type", headerName: "Tipo", width: 120 },
    {
      field: "account",
      headerName: "Cuenta",
      width: 340,
      valueGetter: (_v, row) => {
        const r = row as BankMovement;
        if (r.type === "IN" || r.type === "OUT") {
          const a = r.account;
          return a ? `${a.bank?.name ?? ""} - ${a.alias} (${a.currency})` : "";
        }
        const f = r.fromAccount;
        const t = r.toAccount;
        return `${f ? `${f.bank?.name ?? ""} - ${f.alias}` : ""} → ${
          t ? `${t.bank?.name ?? ""} - ${t.alias}` : ""
        }`;
      },
    },
    {
      field: "amount",
      headerName: "Monto",
      width: 150,
      valueGetter: (_v, row) => fmtPY.format(Number(row?.amount ?? 0)),
    },
    { field: "currency", headerName: "Moneda", width: 110 },
    { field: "description", headerName: "Descripción", flex: 1, minWidth: 220 },
    { field: "reference", headerName: "Referencia", width: 160 },
    {
      field: "isCancelled",
      headerName: "Estado",
      width: 120,
      valueGetter: (_v, row) => (row?.isCancelled ? "CANCEL" : "OK"),
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
      renderCell: (p: GridRenderCellParams<BankMovement>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              title="Cancelar"
              onClick={() => cancelMovement(row.id)}
              disabled={row.isCancelled}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // =====================
  // UI computed
  // =====================
  const activeBanks = useMemo(
    () => banks.filter((b) => b.isActive).length,
    [banks]
  );
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.isActive).length,
    [accounts]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* PAGE HEADER */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Parámetros de Bancos</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Mantené bancos y cuentas, y registrá movimientos
              (entradas/salidas/transferencias) para ver cómo cambia tu dinero
              por cuenta y por fecha.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">
                <Landmark className="h-3.5 w-3.5" />
                Bancos: {banks.length} (activos {activeBanks})
              </Chip>
              <Chip tone="neutral">
                <CreditCard className="h-3.5 w-3.5" />
                Cuentas: {accounts.length} (activas {activeAccounts})
              </Chip>
              <Chip tone={tab === "movements" ? "ok" : "neutral"}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Movimientos: {tab === "movements" ? movementsCount : "—"}
              </Chip>

              {totalsCurrent.map((t) => (
                <Chip key={t.currency} tone="neutral">
                  {t.currency}: {Math.round(t.total).toLocaleString("es-PY")}
                </Chip>
              ))}
            </div>
          </div>

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

      {/* TABS */}
      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList className="w-full justify-start gap-1 rounded-xl border bg-white p-1 shadow-sm">
          <TabsTrigger
            value="banks"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Bancos
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Cuentas
          </TabsTrigger>
          <TabsTrigger
            value="movements"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Movimientos
          </TabsTrigger>
        </TabsList>

        {/* BANKS */}
        <TabsContent value="banks" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Landmark className="h-5 w-5 text-purple-600" />}
              title="Bancos"
              subtitle="ABM de bancos. Si tiene cuentas asociadas, no podrás eliminar: desactivalo."
              right={
                <Button
                  onClick={openCreateBank}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Banco
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={banks}
                    getRowId={(r: Bank): GridRowId => r.id}
                    columns={bankCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 10, page: 0 },
                      },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>

        {/* ACCOUNTS */}
        <TabsContent value="accounts" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<CreditCard className="h-5 w-5 text-purple-600" />}
              title="Cuentas"
              subtitle="Cada cuenta pertenece a un banco. Moneda + saldo inicial para arrancar el tracking."
              right={
                <Button
                  onClick={openCreateAccount}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={accounts}
                    getRowId={(r: BankAccount): GridRowId => r.id}
                    columns={accountCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 10, page: 0 },
                      },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>

        {/* MOVEMENTS */}
        <TabsContent value="movements" className="space-y-4 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<ArrowLeftRight className="h-5 w-5 text-purple-600" />}
              title="Movimientos"
              subtitle="Entradas, salidas y transferencias entre cuentas. Filtrá por cuenta y rango de fechas."
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
                <div className="md:col-span-2">
                  <Label>Cuenta</Label>
                  <Select
                    value={filterAccountId}
                    onValueChange={setFilterAccountId}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">Todas</SelectItem>
                      {accountsOptions.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.label}
                        </SelectItem>
                      ))}
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

                <div className="md:col-span-4 flex flex-col gap-2 md:flex-row md:justify-end">
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
                    getRowId={(r: BankMovement): GridRowId => r.id}
                    columns={movementCols}
                    loading={loading}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 10, page: 0 },
                      },
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

      {/* DIALOG BANCO */}
      <Dialog open={openBank} onOpenChange={setOpenBank}>
        <DialogContent className="sm:max-w-[560px] bg-white">
          <DialogHeader>
            <DialogTitle>
              {bankForm.id ? "Editar Banco" : "Nuevo Banco"}
            </DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Código</Label>
              <Input
                className="bg-white"
                value={bankForm.code ?? ""}
                onChange={(e) =>
                  setBankForm((p) => ({ ...p, code: e.target.value }))
                }
                placeholder="ITAU"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Nombre</Label>
              <Input
                className="bg-white"
                value={bankForm.name ?? ""}
                onChange={(e) =>
                  setBankForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Banco Itaú"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!bankForm.isActive}
                onChange={(e) =>
                  setBankForm((p) => ({ ...p, isActive: e.target.checked }))
                }
              />
              <Label>Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenBank(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={saveBank}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CUENTA */}
      <Dialog open={openAccount} onOpenChange={setOpenAccount}>
        <DialogContent className="sm:max-w-[720px] bg-white">
          <DialogHeader>
            <DialogTitle>
              {accountForm.id ? "Editar Cuenta" : "Nueva Cuenta"}
            </DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Banco</Label>
              <Select
                value={accountForm.bankId ?? ""}
                onValueChange={(v) =>
                  setAccountForm((p: any) => ({ ...p, bankId: v }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar banco" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Alias</Label>
              <Input
                className="bg-white"
                value={accountForm.alias ?? ""}
                onChange={(e) =>
                  setAccountForm((p: any) => ({ ...p, alias: e.target.value }))
                }
                placeholder="ITAU Cta Principal"
              />
            </div>

            <div>
              <Label>Moneda</Label>
              <Select
                value={accountForm.currency ?? "PYG"}
                onValueChange={(v) =>
                  setAccountForm((p: any) => ({ ...p, currency: v }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="PYG">PYG</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Nro Cuenta</Label>
              <Input
                className="bg-white"
                value={accountForm.accountNumber ?? ""}
                onChange={(e) =>
                  setAccountForm((p: any) => ({
                    ...p,
                    accountNumber: e.target.value,
                  }))
                }
                placeholder="123-456-789"
              />
            </div>

            <div>
              <Label>Saldo Inicial</Label>
              <Input
                className="bg-white"
                value={accountForm.initialBalance ?? "0"}
                onChange={(e) =>
                  setAccountForm((p: any) => ({
                    ...p,
                    initialBalance: fmtInput(e.target.value),
                  }))
                }
              />
            </div>

            <div>
              <Label>Fecha Saldo Inicial</Label>
              <Input
                className="bg-white"
                type="date"
                value={accountForm.initialBalanceDate ?? ""}
                onChange={(e) =>
                  setAccountForm((p: any) => ({
                    ...p,
                    initialBalanceDate: e.target.value,
                  }))
                }
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!accountForm.isActive}
                onChange={(e) =>
                  setAccountForm((p: any) => ({
                    ...p,
                    isActive: e.target.checked,
                  }))
                }
              />
              <Label>Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setOpenAccount(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={saveAccount}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG MOVIMIENTO */}
      <Dialog open={openMovement} onOpenChange={setOpenMovement}>
        <DialogContent className="sm:max-w-[760px] bg-white">
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento</DialogTitle>
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
                value={movementForm.type ?? "IN"}
                onValueChange={(v) =>
                  setMovementForm((p: any) => ({ ...p, type: v }))
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
              <div className="md:col-span-2">
                <Label>Cuenta</Label>
                <Select
                  value={movementForm.accountId ?? ""}
                  onValueChange={(v) =>
                    setMovementForm((p: any) => ({ ...p, accountId: v }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {accountsOptions.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {movementForm.type === "TRANSFER" && (
              <>
                <div>
                  <Label>Cuenta Origen</Label>
                  <Select
                    value={movementForm.fromAccountId ?? ""}
                    onValueChange={(v) =>
                      setMovementForm((p: any) => ({
                        ...p,
                        fromAccountId: v,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Origen" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {accountsOptions.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Cuenta Destino</Label>
                  <Select
                    value={movementForm.toAccountId ?? ""}
                    onValueChange={(v) =>
                      setMovementForm((p: any) => ({
                        ...p,
                        toAccountId: v,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Destino" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {accountsOptions.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.label}
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
                  setMovementForm((p: any) => ({
                    ...p,
                    reference: e.target.value,
                  }))
                }
                placeholder="Comprobante / Nro operación"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Descripción</Label>
              <Input
                className="bg-white"
                value={movementForm.description ?? ""}
                onChange={(e) =>
                  setMovementForm((p: any) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                placeholder="Detalle del movimiento"
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
    </div>
  );
}
