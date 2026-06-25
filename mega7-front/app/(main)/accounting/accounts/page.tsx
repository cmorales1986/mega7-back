"use client";

import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  BookMarked, RefreshCcw, Plus, Pencil, Trash2,
  ChevronRight, ChevronDown, ChevronsUpDown,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type AccountType = "Activo" | "Pasivo" | "Patrimonio" | "Ingresos" | "Costos" | "Gastos";
type AccountNature = "Deudora" | "Acreedora";

type AccountNode = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  level: number;
  isTitle: boolean;
  isActive: boolean;
  parentId?: number | null;
  type: AccountType;
  nature: AccountNature;
  children: AccountNode[];
};

type FlatAccount = {
  id: number; code: string; name: string; level: number;
  isTitle: boolean; type: AccountType; nature: AccountNature; isActive: boolean;
};

// ── Colores por tipo ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<AccountType, { bg: string; text: string; border: string }> = {
  Activo:     { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  Pasivo:     { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  Patrimonio: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Ingresos:   { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200" },
  Costos:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  Gastos:     { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
};

const defaultNature: Record<AccountType, AccountNature> = {
  Activo: "Deudora", Pasivo: "Acreedora", Patrimonio: "Acreedora",
  Ingresos: "Acreedora", Costos: "Deudora", Gastos: "Deudora",
};

// ── Componente fila del árbol ─────────────────────────────────────────────────

function AccountRow({
  node, depth, expanded, toggleExpand, onEdit, onDelete,
}: {
  node: AccountNode;
  depth: number;
  expanded: Set<number>;
  toggleExpand: (id: number) => void;
  onEdit: (n: AccountNode) => void;
  onDelete: (n: AccountNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const c = TYPE_COLORS[node.type];

  return (
    <>
      <tr
        className={`border-b transition-colors hover:bg-slate-50 ${!node.isActive ? "opacity-50" : ""}`}
      >
        {/* Código */}
        <td className="py-2 px-3 font-mono text-sm whitespace-nowrap">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="mr-1 h-5 w-5 flex-shrink-0 flex items-center justify-center rounded hover:bg-slate-200"
              >
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                }
              </button>
            ) : (
              <span className="mr-1 h-5 w-5 flex-shrink-0" />
            )}
            <span className={`font-semibold ${node.isTitle ? "text-slate-800" : "text-slate-600"}`}>
              {node.code}
            </span>
          </div>
        </td>

        {/* Nombre */}
        <td className="py-2 px-3">
          <span className={`text-sm ${node.isTitle ? "font-semibold text-slate-800" : "text-slate-600"}`}>
            {node.name}
          </span>
          {node.description && (
            <div className="text-xs text-slate-400 mt-0.5">{node.description}</div>
          )}
        </td>

        {/* Tipo */}
        <td className="py-2 px-3">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.bg} ${c.text} ${c.border}`}>
            {node.type}
          </span>
        </td>

        {/* Naturaleza */}
        <td className="py-2 px-3 text-sm text-slate-600">{node.nature}</td>

        {/* Nivel */}
        <td className="py-2 px-3 text-center">
          <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
            N{node.level}
          </span>
        </td>

        {/* Tipo mov/título */}
        <td className="py-2 px-3 text-center">
          {node.isTitle ? (
            <span className="text-[11px] font-semibold bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">
              TÍTULO
            </span>
          ) : (
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
              MOVIMIENTO
            </span>
          )}
        </td>

        {/* Acciones */}
        <td className="py-2 px-3">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              title="Editar" onClick={() => onEdit(node)}
            >
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              title="Eliminar" onClick={() => onDelete(node)}
              disabled={hasChildren}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Hijos recursivos */}
      {isExpanded && node.children.map((child) => (
        <AccountRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

// ── Formulario inicial vacío ──────────────────────────────────────────────────

const EMPTY_FORM = {
  code: "", name: "", description: "",
  level: 1, isTitle: false,
  type: "Activo" as AccountType,
  nature: "Deudora" as AccountNature,
  isActive: true, parentId: null as number | null,
};

// ── Página principal ──────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [tree, setTree]           = useState<AccountNode[]>([]);
  const [flatList, setFlatList]   = useState<FlatAccount[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<AccountNode | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    try {
      const [treeRes, flatRes] = await Promise.all([
        api.get<AccountNode[]>("/accounts"),
        api.get<FlatAccount[]>("/accounts/flat"),
      ]);
      setTree(treeRes.data ?? []);
      setFlatList(flatRes.data ?? []);
      // Auto-expandir niveles 1 y 2
      const ids = new Set<number>();
      const collect = (nodes: AccountNode[]) => {
        for (const n of nodes) {
          if (n.level <= 2 && n.children.length > 0) ids.add(n.id);
          collect(n.children);
        }
      };
      collect(treeRes.data ?? []);
      setExpanded(ids);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el plan de cuentas"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Expand / collapse ─────────────────────────────────────────────────────

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const ids = new Set<number>();
    const collect = (nodes: AccountNode[]) => {
      for (const n of nodes) { if (n.children.length > 0) ids.add(n.id); collect(n.children); }
    };
    collect(tree);
    setExpanded(ids);
  };

  const collapseAll = () => setExpanded(new Set());

  // ── Filtro de búsqueda (aplana el árbol para mostrar resultados) ──────────

  const flattenTree = (nodes: AccountNode[]): AccountNode[] =>
    nodes.flatMap((n) => [n, ...flattenTree(n.children)]);

  const allFlat = useMemo(() => flattenTree(tree), [tree]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return null; // null = mostrar árbol normal
    return allFlat.filter(
      (n) => n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)
    );
  }, [search, allFlat]);

  // ── Cuentas válidas como padre (solo títulos activas) ─────────────────────

  const parentOptions = useMemo(
    () => flatList.filter((a) => a.isTitle && a.isActive),
    [flatList]
  );

  // ── Diálogo ───────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  };

  const openEdit = (node: AccountNode) => {
    setEditing(node);
    setForm({
      code: node.code, name: node.name, description: node.description ?? "",
      level: node.level, isTitle: node.isTitle, type: node.type,
      nature: node.nature, isActive: node.isActive, parentId: node.parentId ?? null,
    });
    setOpen(true);
  };

  const setField = (key: keyof typeof EMPTY_FORM, val: any) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      // Auto-sugerir naturaleza al cambiar tipo
      if (key === "type") next.nature = defaultNature[val as AccountType];
      return next;
    });
  };

  const save = async () => {
    if (!form.code.trim()) return Swal.fire("Validación", "El código es obligatorio.", "warning");
    if (!form.name.trim()) return Swal.fire("Validación", "El nombre es obligatorio.", "warning");
    if (form.level < 1 || form.level > 5) return Swal.fire("Validación", "El nivel debe ser entre 1 y 5.", "warning");

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim().toUpperCase(),
        description: form.description?.trim() || null,
        level: Number(form.level),
        isTitle: form.isTitle,
        type: form.type,
        nature: form.nature,
        isActive: form.isActive,
        parentId: form.parentId,
      };

      if (!editing) {
        await api.post("/accounts", payload);
        Swal.fire("OK", "Cuenta creada correctamente.", "success");
      } else {
        await api.put(`/accounts/${editing.id}`, payload);
        Swal.fire("OK", "Cuenta actualizada.", "success");
      }
      setOpen(false);
      await loadAll();
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar la cuenta"), "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (node: AccountNode) => {
    const r = await Swal.fire({
      title: `Eliminar ${node.code}`,
      text: `"${node.name}" — Esta acción no se puede deshacer.`,
      icon: "warning", showCancelButton: true,
      confirmButtonText: "Sí, eliminar", cancelButtonText: "No",
      confirmButtonColor: "#d33",
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/accounts/${node.id}`);
      await loadAll();
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo eliminar"), "error");
    }
  };

  // ── Estadísticas ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const all = flattenTree(tree);
    return {
      total:      all.length,
      titulos:    all.filter((a) => a.isTitle).length,
      movimiento: all.filter((a) => !a.isTitle).length,
      activos:    all.filter((a) => a.type === "Activo").length,
      pasivos:    all.filter((a) => a.type === "Pasivo").length,
      ingresos:   all.filter((a) => a.type === "Ingresos").length,
      gastos:     all.filter((a) => a.type === "Gastos" || a.type === "Costos").length,
    };
  }, [tree]);

  // ── Render ────────────────────────────────────────────────────────────────

  const rowsToRender = filtered ?? tree;
  const isSearching  = filtered !== null;

  return (
    <PageShell
      icon={<BookMarked className="h-5 w-5 text-emerald-600" />}
      title="Plan de Cuentas"
      subtitle="Estructura contable jerárquica. Cuentas título agrupan, cuentas de movimiento reciben asientos."
      chips={
        <>
          <Chip tone="info">Total: {stats.total}</Chip>
          <Chip tone="neutral">Títulos: {stats.titulos}</Chip>
          <Chip tone="ok">Movimiento: {stats.movimiento}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadAll} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button onClick={openNew} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
            <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta
          </Button>
        </>
      }
    >
      {/* Resumen por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        {(Object.entries(TYPE_COLORS) as [AccountType, typeof TYPE_COLORS[AccountType]][]).map(([type, c]) => {
          const count = allFlat.filter((a) => a.type === type).length;
          return (
            <div key={type} className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
              <div className={`text-xs font-semibold ${c.text}`}>{type}</div>
              <div className={`text-xl font-bold ${c.text}`}>{count}</div>
              <div className="text-xs text-slate-500">cuentas</div>
            </div>
          );
        })}
      </div>

      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<BookMarked className="h-5 w-5 text-emerald-600" />}
          title="Árbol de Cuentas"
          subtitle="Expandí o colapsá los grupos. Las cuentas de movimiento son las que reciben asientos contables."
        />

        <Separator className="my-4" />

        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="Buscar por código o nombre…"
            className="max-w-sm bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!isSearching && (
            <>
              <Button variant="outline" size="sm" className="bg-white" onClick={expandAll}>
                <ChevronsUpDown className="mr-1 h-3.5 w-3.5" /> Expandir todo
              </Button>
              <Button variant="outline" size="sm" className="bg-white" onClick={collapseAll}>
                Colapsar todo
              </Button>
            </>
          )}
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide">
                <th className="py-2 px-3 text-left w-44">Código</th>
                <th className="py-2 px-3 text-left">Nombre</th>
                <th className="py-2 px-3 text-left w-32">Tipo</th>
                <th className="py-2 px-3 text-left w-28">Naturaleza</th>
                <th className="py-2 px-3 text-center w-16">Nivel</th>
                <th className="py-2 px-3 text-center w-28">Clasificación</th>
                <th className="py-2 px-3 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : rowsToRender.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No hay cuentas.</td></tr>
              ) : isSearching ? (
                // Vista plana en búsqueda
                (rowsToRender as AccountNode[]).map((node) => (
                  <AccountRow
                    key={node.id} node={{ ...node, children: [] }} depth={node.level - 1}
                    expanded={expanded} toggleExpand={toggleExpand}
                    onEdit={openEdit} onDelete={deleteAccount}
                  />
                ))
              ) : (
                // Vista árbol normal
                (rowsToRender as AccountNode[]).map((node) => (
                  <AccountRow
                    key={node.id} node={node} depth={0}
                    expanded={expanded} toggleExpand={toggleExpand}
                    onEdit={openEdit} onDelete={deleteAccount}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Dialog crear/editar ────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-emerald-600" />
              {editing ? "Editar Cuenta" : "Nueva Cuenta"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">

            {/* Código + Nivel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code" className="uppercase mt-1"
                  placeholder="Ej: 1.01.001"
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label htmlFor="level">Nivel (1-5) *</Label>
                <Input
                  id="level" type="number" min={1} max={5} className="mt-1"
                  value={form.level}
                  onChange={(e) => setField("level", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {/* Nombre */}
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name" className="uppercase mt-1"
                placeholder="Ej: CAJA PRINCIPAL"
                value={form.name}
                onChange={(e) => setField("name", e.target.value.toUpperCase())}
              />
            </div>

            {/* Descripción */}
            <div>
              <Label htmlFor="desc">Descripción</Label>
              <Input
                id="desc" className="mt-1"
                placeholder="Opcional…"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>

            {/* Tipo + Naturaleza */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Cuenta *</Label>
                <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Activo","Pasivo","Patrimonio","Ingresos","Costos","Gastos"] as AccountType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Naturaleza *</Label>
                <Select value={form.nature} onValueChange={(v) => setField("nature", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deudora">Deudora (Debe)</SelectItem>
                    <SelectItem value="Acreedora">Acreedora (Haber)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cuenta Padre */}
            <div>
              <Label>Cuenta Padre (opcional)</Label>
              <Select
                value={form.parentId?.toString() ?? "none"}
                onValueChange={(v) => setField("parentId", v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sin padre (cuenta raíz)" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">— Sin padre (raíz) —</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checkboxes */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.isTitle}
                  onChange={(e) => setField("isTitle", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium">Cuenta Título</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium">Activa</span>
              </label>
            </div>

            {form.isTitle ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Las cuentas título sirven para agrupar. No pueden recibir asientos contables directamente.
              </p>
            ) : (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Las cuentas de movimiento son las que reciben débitos y créditos en los asientos.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={save} disabled={saving}
              className="bg-[#C5A05A] hover:bg-[#b8934f] text-white"
            >
              {saving ? "Guardando…" : editing ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
