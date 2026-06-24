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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  RefreshCcw,
  Shield,
  KeyRound,
  UserCheck,
  UserX,
  Users as UsersIcon,
  Plus,
  Trash2,
  ShieldCheck,
} from "lucide-react";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);

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
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

type UserRow = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: string;
};

type AppRole = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
};

export default function UsersPage() {
  const [loading, setLoading]   = useState(false);
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [roles, setRoles]       = useState<AppRole[]>([]);
  const [search, setSearch]     = useState("");

  // panel de nuevo rol
  const [roleOpen, setRoleOpen]       = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [savingRole, setSavingRole]   = useState(false);

  // ── loaders ────────────────────────────────────────────────────────────────
  const loadUsers = async () => {
    const res = await api.get<UserRow[]>("/users");
    setUsers((Array.isArray(res.data) ? res.data : []).filter(Boolean));
  };

  const loadRoles = async () => {
    const res = await api.get<AppRole[]>("/approles");
    setRoles(Array.isArray(res.data) ? res.data : []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadRoles()]);
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
        const meRes = await api.get("/auth/me");
        const r = String(meRes.data?.role ?? "").toUpperCase();
        if (r !== "ADMIN") { window.location.href = "/dashboard"; return; }
        await Promise.all([loadUsers(), loadRoles()]);
      } catch (e: any) {
        Swal.fire("Error", e?.response?.data ?? e.message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── computed ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.username, u.fullName, u.email, u.role].filter(Boolean).some((x) => String(x).toLowerCase().includes(q))
    );
  }, [users, search]);

  const totals = useMemo(() => {
    const total    = users.length;
    const active   = users.filter((u) => u.isActive).length;
    const inactive = total - active;
    const byRole   = new Map<string, number>();
    for (const u of users) {
      const r = String(u.role ?? "").toUpperCase();
      byRole.set(r, (byRole.get(r) ?? 0) + 1);
    }
    return { total, active, inactive, byRole: Array.from(byRole.entries()) };
  }, [users]);

  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  // ── user actions ────────────────────────────────────────────────────────────
  const changeRole = async (u: UserRow) => {
    const inputOptions: Record<string, string> = {};
    roleNames.forEach((r) => (inputOptions[r] = r));

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
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const resetPassword = async (u: UserRow) => {
    const r = await Swal.fire({
      title: "Resetear contraseña?",
      html: `<div style="text-align:left"><b>Usuario:</b> ${u.fullName} (${u.username})<div style="margin-top:8px;color:#b45309">Se generará una contraseña temporal.</div></div>`,
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
        html: `<div style="text-align:left"><div style="margin-bottom:8px">Compartí esta contraseña:</div><div style="font-size:18px;font-weight:700;padding:10px;border:1px dashed #999;border-radius:8px;background:#f8fafc">${tempPassword}</div><div style="margin-top:10px;color:#64748b;font-size:12px">Solo se muestra una vez.</div></div>`,
        confirmButtonText: "Copiar",
        preConfirm: async () => { try { await navigator.clipboard.writeText(tempPassword); } catch {} },
      });
      await loadUsers();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  // ── role actions ────────────────────────────────────────────────────────────
  const createRole = async () => {
    if (!newRoleName.trim()) return Swal.fire("Validación", "El nombre es obligatorio.", "warning");
    setSavingRole(true);
    try {
      await api.post("/approles", { name: newRoleName.trim(), description: newRoleDesc.trim() || null });
      Swal.fire("OK", `Rol ${newRoleName.toUpperCase()} creado.`, "success");
      setRoleOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      await loadRoles();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    } finally {
      setSavingRole(false);
    }
  };

  const deleteRole = async (role: AppRole) => {
    if (role.isSystem) return Swal.fire("No permitido", "Los roles del sistema no se pueden eliminar.", "warning");
    if (role.userCount > 0)
      return Swal.fire("No permitido", `El rol "${role.name}" está asignado a ${role.userCount} usuario(s). Cambiá sus roles primero.`, "warning");

    const r = await Swal.fire({
      title: `Eliminar rol "${role.name}"?`,
      text: "Se quitarán también todos sus permisos.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No",
      confirmButtonColor: "#d33",
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/approles/${role.id}`);
      await loadRoles();
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e.message, "error");
    }
  };

  const canEdit       = usePermission("Users.Edit");
  const canDeactivate = usePermission("Users.Deactivate");

  const cols: GridColDef<UserRow>[] = [
    { field: "id",       headerName: "ID",      width: 80 },
    { field: "username", headerName: "Usuario", width: 160 },
    { field: "fullName", headerName: "Nombre",  flex: 1, minWidth: 220 },
    { field: "email",    headerName: "Email",   width: 250 },
    {
      field: "role",
      headerName: "Rol",
      width: 140,
      renderCell: (p: GridRenderCellParams<UserRow>) => (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
          {String(p.row?.role ?? "").toUpperCase()}
        </span>
      ),
    },
    {
      field: "isActive",
      headerName: "Activo",
      width: 110,
      renderCell: (p: GridRenderCellParams<UserRow>) =>
        p.row?.isActive ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Sí</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">No</span>
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
      renderCell: (p: GridRenderCellParams<UserRow>) => {
        const row = p.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-1.5">
            {canEdit && (
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white" onClick={() => changeRole(row)} title="Cambiar rol">
                <Shield className="h-4 w-4" />
              </Button>
            )}
            {canDeactivate && (
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white" onClick={() => toggleActive(row)} title={row.isActive ? "Desactivar" : "Activar"}>
                {row.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white" onClick={() => resetPassword(row)} title="Reset contraseña">
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
            <p className="mt-2 text-sm text-muted-foreground">Gestión de usuarios y roles. Solo disponible para ADMIN.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info"><UsersIcon className="h-3.5 w-3.5" /> Total: {totals.total}</Chip>
              <Chip tone="ok"><UserCheck className="h-3.5 w-3.5" /> Activos: {totals.active}</Chip>
              <Chip tone="warn"><UserX className="h-3.5 w-3.5" /> Inactivos: {totals.inactive}</Chip>
              {totals.byRole.map(([r, n]) => (
                <Chip key={r} tone="neutral">{r}: {n}</Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="w-[280px]">
              <Label>Buscar</Label>
              <Input className="bg-white" placeholder="usuario / nombre / email / rol" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={refreshAll} disabled={loading} className="bg-white self-end">
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        </div>
      </div>

      {/* USERS GRID */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border bg-white p-2 shadow-sm">
              <UsersIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Listado de Usuarios</h2>
              <p className="text-sm text-muted-foreground">Cambiar rol, activar/desactivar, resetear contraseña.</p>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div style={{ height: 480, width: "100%" }}>
              <DataGrid
                rows={filtered}
                getRowId={(r: UserRow): GridRowId => r.id}
                columns={cols}
                loading={loading}
                pageSizeOptions={[10, 25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                slots={{ toolbar: GridToolbar }}
                disableRowSelectionOnClick
              />
            </div>
          </ThemeProvider>
        </div>
      </Card>

      {/* ROLES PANEL */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border bg-white p-2 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Gestión de Roles</h2>
              <p className="text-sm text-muted-foreground">Creá roles personalizados y asignalos a usuarios. Los del sistema no se pueden eliminar.</p>
            </div>
          </div>
          <Button onClick={() => setRoleOpen(true)} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Rol
          </Button>
        </div>

        <Separator className="my-4" />

        {roles.length === 0 ? (
          <div className="text-sm text-gray-400 py-4">Sin roles cargados.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((role) => (
              <div key={role.id} className="flex items-start justify-between rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{role.name}</span>
                    {role.isSystem && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">SISTEMA</span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{role.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {role.userCount === 0 ? "Sin usuarios" : `${role.userCount} usuario(s)`}
                  </p>
                </div>
                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => deleteRole(role)}
                    title="Eliminar rol"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* DIALOG NUEVO ROL */}
      <Dialog open={roleOpen} onOpenChange={(v) => { setRoleOpen(v); if (!v) { setNewRoleName(""); setNewRoleDesc(""); } }}>
        <DialogContent className="sm:max-w-[420px] bg-white">
          <DialogHeader>
            <DialogTitle>Nuevo Rol</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre del rol</Label>
              <Input
                className="bg-white uppercase"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value.toUpperCase())}
                placeholder="SOPORTE"
                maxLength={30}
              />
              <p className="text-xs text-gray-400">Solo letras mayúsculas, números y guión bajo (ej: SOPORTE, GERENTE_ZONA)</p>
            </div>
            <div className="grid gap-2">
              <Label>Descripción <span className="text-gray-400">(opcional)</span></Label>
              <Input className="bg-white" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Acceso a..." maxLength={120} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-white" onClick={() => setRoleOpen(false)} disabled={savingRole}>Cancelar</Button>
            <Button onClick={createRole} disabled={savingRole} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white">Crear Rol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
