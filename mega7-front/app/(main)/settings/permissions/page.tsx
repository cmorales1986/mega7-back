"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Shield, Save, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PermissionDef {
  id: number;
  code: string;
  module: string;
  action: string;
  displayName: string;
  group: string;
  sortOrder: number;
}

interface GroupedPerms {
  [group: string]: PermissionDef[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();

  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [allPerms, setAllPerms] = useState<PermissionDef[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Guard: solo ADMIN
  useEffect(() => {
    if (user !== null && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  // Cargar todos los permisos del sistema (una sola vez)
  useEffect(() => {
    api.get<PermissionDef[]>("/permissions")
      .then((r) => {
        setAllPerms(r.data);
        // Expandir todos los grupos por defecto
        const groups = new Set(r.data.map((p) => p.group));
        setExpandedGroups(groups);
      })
      .catch(() => toast.error("Error cargando permisos del sistema"));
  }, []);

  // Cargar roles disponibles (excluye ADMIN, sus permisos no son configurables)
  useEffect(() => {
    api.get<string[]>("/permissions/roles")
      .then((r) => {
        const sorted = r.data
          .filter((role) => role.toUpperCase() !== "ADMIN")
          .sort();
        setRoles(sorted);
        if (sorted.length > 0) setSelectedRole(sorted[0]);
      })
      .catch(() => toast.error("Error cargando roles"));
  }, []);

  // Cargar permisos del rol seleccionado
  const loadRolePerms = useCallback(async (role: string) => {
    if (!role) return;
    setLoading(true);
    try {
      const r = await api.get<{ roleName: string; permissions: string[] }>(
        `/permissions/role/${role}`
      );
      setChecked(new Set(r.data.permissions));
    } catch {
      toast.error("Error cargando permisos del rol");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRole) loadRolePerms(selectedRole);
  }, [selectedRole, loadRolePerms]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const grouped: GroupedPerms = allPerms.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {} as GroupedPerms);

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupCodes = grouped[group]?.map((p) => p.code) ?? [];
    const allChecked = groupCodes.every((c) => checked.has(c));
    setChecked((prev) => {
      const next = new Set(prev);
      groupCodes.forEach((c) => (allChecked ? next.delete(c) : next.add(c)));
      return next;
    });
  };

  const toggleAll = () => {
    const allCodes = allPerms.map((p) => p.code);
    const allChecked = allCodes.every((c) => checked.has(c));
    setChecked(allChecked ? new Set() : new Set(allCodes));
  };

  const toggleExpandGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/role/${selectedRole}`, {
        permissionCodes: Array.from(checked),
      });
      toast.success(`Permisos de ${selectedRole} guardados correctamente`);
    } catch {
      toast.error("Error guardando los permisos");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isAdmin) return null;

  const groupNames = Object.keys(grouped);
  const totalChecked = checked.size;
  const totalPerms = allPerms.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2563eb]/10 rounded-lg">
            <Shield className="text-[#2563eb]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Gestión de Permisos</h1>
            <p className="text-sm text-gray-500">
              Configurá qué puede hacer cada rol en el sistema
            </p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving || loading || !selectedRole}
          className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Guardar cambios
        </button>
      </div>

      {/* Tabs de Roles */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Seleccioná el rol a configurar
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                  selectedRole === role
                    ? "bg-[#2563eb] text-white border-[#2563eb] shadow"
                    : "bg-white text-gray-700 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Info del rol */}
        {selectedRole && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Rol: <strong>{selectedRole}</strong> · {totalChecked} de {totalPerms} permisos activos
            </span>
            <div className="flex gap-3">
              <button
                onClick={toggleAll}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                {totalChecked === totalPerms ? "Desmarcar todo" : "Marcar todo"}
              </button>
            </div>
          </div>
        )}

        {/* Matriz de permisos */}
        <div className="divide-y">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              Cargando permisos...
            </div>
          ) : (
            groupNames.map((group) => {
              const groupPerms = grouped[group];
              const groupCodes = groupPerms.map((p) => p.code);
              const checkedInGroup = groupCodes.filter((c) => checked.has(c)).length;
              const allInGroupChecked = checkedInGroup === groupCodes.length;
              const someInGroupChecked = checkedInGroup > 0 && !allInGroupChecked;
              const isExpanded = expandedGroups.has(group);

              return (
                <div key={group}>
                  {/* Cabecera del grupo */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none"
                    onClick={() => toggleExpandGroup(group)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(group);
                      }}
                      className="flex-shrink-0"
                    >
                      <input
                        type="checkbox"
                        checked={allInGroupChecked}
                        ref={(el) => { if (el) el.indeterminate = someInGroupChecked; }}
                        onChange={() => toggleGroup(group)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-[#2563eb] cursor-pointer"
                      />
                    </button>

                    <span className="font-semibold text-gray-700 flex-1">{group}</span>

                    <span className="text-xs text-gray-400 mr-2">
                      {checkedInGroup}/{groupCodes.length}
                    </span>

                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </div>

                  {/* Permisos del grupo */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
                      {groupPerms.map((perm) => (
                        <label
                          key={perm.code}
                          className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-amber-50 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={checked.has(perm.code)}
                            onChange={() => toggle(perm.code)}
                            className="w-4 h-4 accent-[#2563eb] cursor-pointer flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 truncate">{perm.displayName}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{perm.code}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Botón guardar al pie */}
      <div className="flex justify-end pb-4">
        <button
          onClick={save}
          disabled={saving || loading || !selectedRole}
          className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50 shadow"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
