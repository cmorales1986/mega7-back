"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  BookOpen, RefreshCcw, Plus, Pencil, Trash2,
  ChevronDown, ChevronRight, CheckCircle2, Clock, Send,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type JournalStatus = "Borrador" | "Contabilizado";
type JournalSource = "Manual" | "Venta" | "Compra" | "Pago" | "Cobro" | "Banco" | "Caja" | "Ajuste";

type JournalEntry = {
  id: number;
  date: string;
  description: string;
  reference: string | null;
  sourceType: JournalSource;
  status: JournalStatus;
  createdAt: string;
  createdBy: string | null;
  sourceId: number | null;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
};

type JournalLine = {
  id?: number;
  accountId: number;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description: string;
};

type FlatAccount = {
  id: number; code: string; name: string;
  isTitle: boolean; type: string; isActive: boolean;
};

// ── Helpers visuales ─────────────────────────────────────────────────────────

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

const SOURCE_LABEL: Record<JournalSource, string> = {
  Manual: "Manual", Venta: "Venta", Compra: "Compra",
  Pago: "Pago", Cobro: "Cobro", Banco: "Banco",
  Caja: "Caja", Ajuste: "Ajuste",
};

// ── Línea de asiento vacía ────────────────────────────────────────────────────

const emptyLine = (): JournalLine => ({
  accountId: 0, accountCode: "", accountName: "",
  debit: 0, credit: 0, description: "",
});

// ── Componente editor de líneas ───────────────────────────────────────────────

function LinesEditor({
  lines, accounts, onChange,
}: {
  lines: JournalLine[];
  accounts: FlatAccount[];
  onChange: (lines: JournalLine[]) => void;
}) {
  const movAccounts = useMemo(
    () => accounts.filter((a) => !a.isTitle && a.isActive),
    [accounts]
  );

  const setLine = (idx: number, field: keyof JournalLine, val: any) => {
    const next = lines.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: val };
      // Si ingresa Debe, limpiar Haber y viceversa
      if (field === "debit"  && val > 0) updated.credit = 0;
      if (field === "credit" && val > 0) updated.debit  = 0;
      return updated;
    });
    onChange(next);
  };

  const setAccount = (idx: number, accountId: number) => {
    const acc = movAccounts.find((a) => a.id === accountId);
    const next = lines.map((l, i) =>
      i !== idx ? l : { ...l, accountId, accountCode: acc?.code ?? "", accountName: acc?.name ?? "" }
    );
    onChange(next);
  };

  const addLine = () => onChange([...lines, emptyLine()]);
  const removeLine = (idx: number) => onChange(lines.filter((_, i) => i !== idx));

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced    = totalDebit > 0 && totalDebit === totalCredit;

  return (
    <div className="space-y-3">
      {/* Tabla de líneas */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase">
              <th className="py-2 px-2 text-left w-80">Cuenta</th>
              <th className="py-2 px-2 text-left">Descripción</th>
              <th className="py-2 px-2 text-right w-40">Debe</th>
              <th className="py-2 px-2 text-right w-40">Haber</th>
              <th className="py-2 px-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="border-t">
                {/* Selector de cuenta */}
                <td className="py-1 px-2">
                  <Select
                    value={line.accountId ? String(line.accountId) : ""}
                    onValueChange={(v) => setAccount(idx, parseInt(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Seleccionar cuenta…">
                        {line.accountId
                          ? `${line.accountCode} — ${line.accountName}`
                          : "Seleccionar cuenta…"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {movAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                          <span className="font-mono mr-2 text-slate-500">{a.code}</span>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* Descripción de línea */}
                <td className="py-1 px-2">
                  <Input
                    className="h-9 text-sm"
                    placeholder="Detalle…"
                    value={line.description}
                    onChange={(e) => setLine(idx, "description", e.target.value)}
                  />
                </td>

                {/* Debe */}
                <td className="py-1 px-2">
                  <Input
                    type="number" min={0} step="any"
                    className="h-9 text-sm text-right font-mono w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    value={line.debit || ""}
                    onChange={(e) => setLine(idx, "debit", parseFloat(e.target.value) || 0)}
                  />
                </td>

                {/* Haber */}
                <td className="py-1 px-2">
                  <Input
                    type="number" min={0} step="any"
                    className="h-9 text-sm text-right font-mono w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    value={line.credit || ""}
                    onChange={(e) => setLine(idx, "credit", parseFloat(e.target.value) || 0)}
                  />
                </td>

                {/* Eliminar fila */}
                <td className="py-1 px-2">
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 2}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-slate-50 font-semibold text-sm">
              <td className="py-2 px-2 text-slate-500 text-xs" colSpan={2}>Totales</td>
              <td className="py-2 px-2 text-right text-blue-700">{fmtMoney(totalDebit)}</td>
              <td className="py-2 px-2 text-right text-emerald-700">{fmtMoney(totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Indicador de balance */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addLine} className="bg-white">
          <Plus className="mr-1 h-3.5 w-3.5" /> Agregar línea
        </Button>
        {totalDebit > 0 || totalCredit > 0 ? (
          balanced ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Asiento cuadrado
            </span>
          ) : (
            <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              Diferencia: {fmtMoney(Math.abs(totalDebit - totalCredit))}
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  reference: "",
  post: false,
  lines: [emptyLine(), emptyLine()] as JournalLine[],
};

export default function JournalPage() {
  const [entries, setEntries]       = useState<JournalEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [accounts, setAccounts]     = useState<FlatAccount[]>([]);

  // Filtros
  const [filterQ,      setFilterQ]      = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFrom,   setFilterFrom]   = useState("");
  const [filterTo,     setFilterTo]     = useState("");

  // Detalle expandido
  const [expanded, setExpanded]         = useState<number | null>(null);
  const [detail,   setDetail]           = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Dialog
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [form,    setForm]    = useState({ ...EMPTY_FORM });
  const [saving,  setSaving]  = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterFrom)  params.set("from", filterFrom);
      if (filterTo)    params.set("to",   filterTo);
      if (filterQ)     params.set("q",    filterQ);

      const res = await api.get(`/journalentries?${params}`);
      setEntries(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el libro diario"), "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterFrom, filterTo, filterQ]);

  const loadAccounts = async () => {
    try {
      const res = await api.get<FlatAccount[]>("/accounts/flat");
      setAccounts(res.data ?? []);
    } catch {}
  };

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Detalle de asiento ─────────────────────────────────────────────────────

  const toggleDetail = async (id: number) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/journalentries/${id}`);
      setDetail(res.data);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e), "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Diálogo ───────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, lines: [emptyLine(), emptyLine()] });
    setOpen(true);
  };

  const openEdit = async (entry: JournalEntry) => {
    try {
      const res = await api.get(`/journalentries/${entry.id}`);
      const d = res.data;
      setEditing(entry);
      setForm({
        date:        d.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        description: d.description ?? "",
        reference:   d.reference   ?? "",
        post:        false,
        lines: (d.lines ?? []).map((l: any) => ({
          accountId:   l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit:       l.debit,
          credit:      l.credit,
          description: l.description ?? "",
        })),
      });
      setOpen(true);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e), "error");
    }
  };

  const save = async (post: boolean) => {
    if (!form.description.trim())
      return Swal.fire("Validación", "La descripción es obligatoria.", "warning");

    const lines = form.lines.filter((l) => l.accountId > 0);
    if (lines.length < 2)
      return Swal.fire("Validación", "El asiento debe tener al menos 2 líneas con cuenta.", "warning");

    const totalD = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
    const totalC = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (totalD !== totalC)
      return Swal.fire("Validación", `El asiento no cuadra: Debe ${fmtMoney(totalD)} / Haber ${fmtMoney(totalC)}`, "warning");

    setSaving(true);
    try {
      const payload = {
        date:        form.date,
        description: form.description.trim(),
        reference:   form.reference?.trim() || null,
        post,
        lines: lines.map((l) => ({
          accountId:   l.accountId,
          debit:       Number(l.debit)  || 0,
          credit:      Number(l.credit) || 0,
          description: l.description?.trim() || null,
        })),
      };

      if (!editing) {
        await api.post("/journalentries", payload);
        Swal.fire("OK", post ? "Asiento contabilizado." : "Borrador guardado.", "success");
      } else {
        await api.put(`/journalentries/${editing.id}`, payload);
        Swal.fire("OK", post ? "Asiento actualizado y contabilizado." : "Borrador actualizado.", "success");
      }
      setOpen(false);
      await loadEntries();
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar el asiento"), "error");
    } finally {
      setSaving(false);
    }
  };

  const postEntry = async (entry: JournalEntry) => {
    const r = await Swal.fire({
      title: "Contabilizar asiento",
      text: `"${entry.description}" — una vez contabilizado no se puede editar.`,
      icon: "warning", showCancelButton: true,
      confirmButtonText: "Contabilizar", cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    try {
      await api.post(`/journalentries/${entry.id}/post`);
      await loadEntries();
      Swal.fire("OK", "Asiento contabilizado.", "success");
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e), "error");
    }
  };

  const deleteEntry = async (entry: JournalEntry) => {
    const r = await Swal.fire({
      title: "Eliminar borrador",
      text: `"${entry.description}"`,
      icon: "warning", showCancelButton: true,
      confirmButtonText: "Eliminar", cancelButtonText: "No",
      confirmButtonColor: "#d33",
    });
    if (!r.isConfirmed) return;
    try {
      await api.delete(`/journalentries/${entry.id}`);
      await loadEntries();
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e), "error");
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    borradores:     entries.filter((e) => e.status === "Borrador").length,
    contabilizados: entries.filter((e) => e.status === "Contabilizado").length,
    totalDebe: entries.reduce((s, e) => s + e.totalDebit, 0),
  }), [entries]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell
      icon={<BookOpen className="h-5 w-5 text-emerald-600" />}
      title="Libro Diario"
      subtitle="Registro cronológico de asientos contables. Las cuentas título no pueden recibir imputaciones."
      chips={
        <>
          <Chip tone="info">Total: {total}</Chip>
          <Chip tone="warn">Borradores: {stats.borradores}</Chip>
          <Chip tone="ok">Contabilizados: {stats.contabilizados}</Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadEntries} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button onClick={openNew} className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Asiento
          </Button>
        </>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<BookOpen className="h-5 w-5 text-emerald-600" />}
          title="Asientos Contables"
          subtitle="Hacé clic en una fila para ver el detalle de líneas."
        />

        <Separator className="my-4" />

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="Buscar descripción o referencia…"
            className="max-w-xs bg-white"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="Borrador">Borradores</SelectItem>
              <SelectItem value="Contabilizado">Contabilizados</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-40 bg-white" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <Input type="date" className="w-40 bg-white" value={filterTo}   onChange={(e) => setFilterTo(e.target.value)} />
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide">
                <th className="py-2 px-3 w-8" />
                <th className="py-2 px-3 text-left w-28">Fecha</th>
                <th className="py-2 px-3 text-left">Descripción</th>
                <th className="py-2 px-3 text-left w-32">Referencia</th>
                <th className="py-2 px-3 text-left w-24">Origen</th>
                <th className="py-2 px-3 text-right w-32">Debe</th>
                <th className="py-2 px-3 text-right w-32">Haber</th>
                <th className="py-2 px-3 text-center w-32">Estado</th>
                <th className="py-2 px-3 text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">No hay asientos.</td></tr>
              ) : entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className={`border-b cursor-pointer transition-colors ${expanded === entry.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                    onClick={() => toggleDetail(entry.id)}
                  >
                    <td className="py-2 px-3 text-center">
                      {expanded === entry.id
                        ? <ChevronDown className="h-4 w-4 text-emerald-600" />
                        : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{fmtDate(entry.date)}</td>
                    <td className="py-2 px-3 font-medium">{entry.description}</td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-xs">{entry.reference ?? "—"}</td>
                    <td className="py-2 px-3">
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                        {SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-blue-700">{fmtMoney(entry.totalDebit)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{fmtMoney(entry.totalCredit)}</td>
                    <td className="py-2 px-3 text-center">
                      {entry.status === "Contabilizado" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Contabilizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                          <Clock className="h-3 w-3" /> Borrador
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {entry.status === "Borrador" && (
                          <>
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0"
                              title="Contabilizar" onClick={() => postEntry(entry)}
                            >
                              <Send className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0"
                              title="Editar" onClick={() => openEdit(entry)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0"
                              title="Eliminar" onClick={() => deleteEntry(entry)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </>
                        )}
                        {entry.status === "Contabilizado" && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Detalle de líneas expandido */}
                  {expanded === entry.id && (
                    <tr key={`${entry.id}-detail`}>
                      <td colSpan={9} className="bg-emerald-50 border-b px-6 py-3">
                        {loadingDetail ? (
                          <div className="text-sm text-slate-400 py-2">Cargando detalle…</div>
                        ) : detail?.id === entry.id ? (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500 font-semibold uppercase">
                                <th className="py-1 text-left">Cuenta</th>
                                <th className="py-1 text-left w-48">Detalle</th>
                                <th className="py-1 text-right w-28">Debe</th>
                                <th className="py-1 text-right w-28">Haber</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.lines?.map((l: any, i: number) => (
                                <tr key={i} className="border-t border-emerald-100">
                                  <td className="py-1 pr-4">
                                    <span className="font-mono text-slate-500 mr-2">{l.accountCode}</span>
                                    {l.accountName}
                                  </td>
                                  <td className="py-1 text-slate-500">{l.description ?? "—"}</td>
                                  <td className="py-1 text-right font-mono text-blue-700">
                                    {l.debit > 0 ? fmtMoney(l.debit) : ""}
                                  </td>
                                  <td className="py-1 text-right font-mono text-emerald-700">
                                    {l.credit > 0 ? fmtMoney(l.credit) : ""}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t border-emerald-200 font-semibold">
                                <td colSpan={2} className="py-1 text-slate-500">Total</td>
                                <td className="py-1 text-right font-mono text-blue-700">{fmtMoney(detail.totalDebit)}</td>
                                <td className="py-1 text-right font-mono text-emerald-700">{fmtMoney(detail.totalCredit)}</td>
                              </tr>
                            </tbody>
                          </table>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Dialog crear/editar asiento ──────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(95vw,1200px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              {editing ? "Editar Asiento" : "Nuevo Asiento"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Cabecera */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date" type="date" className="mt-1"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="desc">Descripción *</Label>
                <Input
                  id="desc" className="mt-1"
                  placeholder="Ej: Cobro factura FAC-0001 cliente X"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ref">Referencia (opcional)</Label>
              <Input
                id="ref" className="mt-1"
                placeholder="Ej: FAC-0001, REC-0042…"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Editor de líneas */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Líneas del asiento</Label>
              <LinesEditor
                lines={form.lines}
                accounts={accounts}
                onChange={(lines) => setForm((f) => ({ ...f, lines }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={saving}
              className="bg-white"
            >
              {saving ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="mr-2 h-4 w-4" />
              {saving ? "Contabilizando…" : "Contabilizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
