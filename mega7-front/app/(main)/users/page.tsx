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

import {
  RefreshCcw,
  Shield,
  KeyRound,
  UserCheck,
  UserX,
  Users as UsersIcon,
} from "lucide-react";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);

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
type UserRow = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: string;
};

type Me = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
};

const ROLES = ["ADMIN", "SUPERVISOR", "CAJERO", "VENTAS"] as const;

// =====================
// Page
// =====================
export default function UsersPage() {
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");

  // =====================
  // Loaders
  // =====================
  const loadMe = async () => {
    const res = await api.get("/auth/me");
    setMe(res.data);
  };

  const loadUsers = async () => {
    const res = await api.get("/users");
    setUsers((Array.isArray(res.data) ? res.data : []).filter(Boolean) as UserRow[]);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMe(), loadUsers()]);
      Swal.fire("OK", "Datos refrescados", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadMe();

        // ✅ si no es admin, afuera
        const role = String((me as any)?.role ?? "").toUpperCase();
        // (nota: como me se setea luego, verificamos con request directo)
        const meRes = await api.get("/auth/me");
        const r = String(meRes.data?.role ?? "").toUpperCase();
        if (r !== "ADMIN") {
          window.location.href = "/dashboard";
          return;
        }

        await loadUsers();
      } catch (e: any) {
        Swal.fire("Error", e?.response?.data ?? e.message, "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================
  // computed
  // =====================
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.username, u.fullName, u.email, u.role]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q))
    );
  }, [users, search]);

  const totals = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = total - active;
    const byRole = new Map<string, number>();
    for (const u of users) {
      const r = String(u.role ?? "").toUpperCase();
      byRole.set(r, (byRole.get(r) ?? 0) + 1);
    }
    return { total, active, inactive, byRole: Array.from(byRole.entries()) };
  }, [users]);

  // =====================
  // actions
  // =====================
  const changeRole = async (u: UserRow) => {
    const inputOptions: Record<string, string> = {};
    ROLES.forEach((r) => (inputOptions[r] = r));

    const { value } = await Swal.fire({
      title: "Cambiar rol",
      text: `${u.fullName} (${u.username})`,
      input: "select",
      inputOptions,
      inputValue: String(u.role ?? "VENTAS").toUpperCase(),
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
    });

    if (!value) return;

    try {
      await api.put(`/users/${u.id}/role`, { role: value });
      await loadUsers();
      Swal.fire("OK", "Rol actualizado", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const toggleActive = async (u: UserRow) => {
    const next = !u.isActive;

    const r = await Swal.fire({
      title: next ? "Activar usuario?" : "Desactivar usuario?",
      text: `${u.fullName} (${u.username})`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: next ? "Activar" : "Desactivar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      await api.put(`/users/${u.id}/active`, { isActive: next });
      await loadUsers();
      Swal.fire("OK", next ? "Usuario activado" : "Usuario desactivado", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const resetPassword = async (u: UserRow) => {
    const r = await Swal.fire({
      title: "Resetear contraseña?",
      html: `
        <div style="text-align:left">
          <div><b>Usuario:</b> ${u.fullName} (${u.username})</div>
          <div style="margin-top:8px;color:#b45309">
            Se generará una contraseña temporal y el usuario quedará obligado a cambiarla al ingresar.
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Resetear",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    try {
      const res = await api.post(`/users/${u.id}/reset-password`);
      const tempPassword = res.data?.tempPassword ?? "";

      await Swal.fire({
        title: "Contraseña temporal",
        html: `
          <div style="text-align:left">
            <div style="margin-bottom:8px">Copiá y compartí esta contraseña con el usuario:</div>
            <div style="font-size:18px;font-weight:700;padding:10px;border:1px dashed #999;border-radius:8px;background:#f8fafc">
              ${tempPassword}
            </div>
            <div style="margin-top:10px;color:#64748b;font-size:12px">
              Solo se muestra una vez. El usuario deberá cambiarla al iniciar sesión.
            </div>
          </div>
        `,
        confirmButtonText: "Copiar",
        preConfirm: async () => {
          try {
            await navigator.clipboard.writeText(tempPassword);
          } catch {}
        },
      });

      await loadUsers();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const canEdit = usePermission("Users.Edit");
  const canDeactivate = usePermission("Users.Deactivate");

  // =====================
  // DataGrid columns
  // =====================
  const cols: GridColDef<UserRow>[] = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "username", headerName: "Usuario", width: 160 },
    { field: "fullName", headerName: "Nombre", flex: 1, minWidth: 240 },
    { field: "email", headerName: "Email", width: 260 },
    {
      field: "role",
      headerName: "Rol",
      width: 140,
      valueGetter: (_v, row) => String(row?.role ?? "").toUpperCase(),
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
      width: 220,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<UserRow>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                onClick={() => changeRole(row)}
                title="Cambiar rol"
              >
                <Shield className="h-4 w-4" />
              </Button>
            )}

            {canDeactivate && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-white"
                onClick={() => toggleActive(row)}
                title={row.isActive ? "Desactivar" : "Activar"}
              >
                {row.isActive ? (
                  <UserX className="h-4 w-4" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              onClick={() => resetPassword(row)}
              title="Reset password"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* PAGE HEADER */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <UsersIcon className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Usuarios</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Gestión de usuarios y permisos. Solo disponible para ADMIN.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">
                <UsersIcon className="h-3.5 w-3.5" />
                Total: {totals.total}
              </Chip>
              <Chip tone="ok">
                <UserCheck className="h-3.5 w-3.5" />
                Activos: {totals.active}
              </Chip>
              <Chip tone="warn">
                <UserX className="h-3.5 w-3.5" />
                Inactivos: {totals.inactive}
              </Chip>

              {totals.byRole.map(([r, n]) => (
                <Chip key={r} tone="neutral">
                  {r}: {n}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="w-[280px]">
              <Label>Buscar</Label>
              <Input
                className="bg-white"
                placeholder="usuario / nombre / email / rol"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              onClick={refreshAll}
              disabled={loading}
              className="bg-white self-end"
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        </div>
      </div>

      {/* GRID */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Shield className="h-5 w-5 text-purple-600" />}
          title="Listado"
          subtitle="Acciones: cambiar rol, activar/desactivar, resetear contraseña."
        />

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div style={{ height: 560, width: "100%" }}>
              <DataGrid
                rows={filtered}
                getRowId={(r: UserRow): GridRowId => r.id}
                columns={cols}
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
    </div>
  );
}
