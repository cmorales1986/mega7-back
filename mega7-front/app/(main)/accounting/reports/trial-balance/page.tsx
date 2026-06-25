"use client";

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Scale, RefreshCcw, Printer, CheckCircle2, AlertTriangle } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Row = {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  nature: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const TYPE_COLOR: Record<string, string> = {
  Activo:     "text-blue-700  bg-blue-50",
  Pasivo:     "text-red-700   bg-red-50",
  Patrimonio: "text-purple-700 bg-purple-50",
  Ingresos:   "text-emerald-700 bg-emerald-50",
  Costos:     "text-amber-700  bg-amber-50",
  Gastos:     "text-orange-700 bg-orange-50",
};

const TYPE_ORDER: Record<string, number> = {
  Activo: 1, Pasivo: 2, Patrimonio: 3, Ingresos: 4, Costos: 5, Gastos: 6,
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstOfYear = `${now.getFullYear()}-01-01`;

  const [from, setFrom] = useState(firstOfYear);
  const [to,   setTo]   = useState(today);
  const [rows,   setRows]   = useState<Row[]>([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to)   p.set("to",   to);
      const res = await api.get(`/accountingreports/trial-balance?${p}`);
      setRows(res.data.rows   ?? []);
      setTotals(res.data.totals ?? { totalDebit: 0, totalCredit: 0 });
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el balance"), "error");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const balanced = Math.abs(totals.totalDebit - totals.totalCredit) < 0.01;

  // Agrupar por tipo de cuenta
  const byType = Object.entries(
    rows.reduce<Record<string, Row[]>>((acc, r) => {
      (acc[r.accountType] ??= []).push(r);
      return acc;
    }, {})
  ).sort(([a], [b]) => (TYPE_ORDER[a] ?? 9) - (TYPE_ORDER[b] ?? 9));

  return (
    <PageShell
      title="Balance de Comprobación"
      icon={<Scale className="h-6 w-6 text-emerald-600" />}
      subtitle="Saldos de todas las cuentas con movimientos en el período."
      chips={
        rows.length > 0 ? (
          <Chip tone={balanced ? "ok" : "warn"}>
            {balanced
              ? "Asientos cuadrados"
              : `Diferencia: ${fmt(Math.abs(totals.totalDebit - totals.totalCredit))}`}
          </Chip>
        ) : undefined
      }
      right={
        <div className="flex gap-2 no-print">
          <Button variant="outline" className="bg-white" onClick={load} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
          <Button variant="outline" className="bg-white" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      }
    >
      <Card className="border-slate-200 p-6 shadow-sm">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 mb-5 no-print">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 whitespace-nowrap">Desde:</span>
            <Input type="date" className="w-40 bg-white" value={from}
              onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 whitespace-nowrap">Hasta:</span>
            <Input type="date" className="w-40 bg-white" value={to}
              onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <Separator className="mb-4" />

        {loading ? (
          <div className="py-20 text-center text-slate-400">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-slate-400">Sin movimientos en el período.</div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide border-b">
                  <th className="py-2 px-3 text-left w-32">Código</th>
                  <th className="py-2 px-3 text-left">Nombre</th>
                  <th className="py-2 px-3 text-right w-36">Debe</th>
                  <th className="py-2 px-3 text-right w-36">Haber</th>
                  <th className="py-2 px-3 text-right w-36">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {byType.map(([type, typeRows]) => {
                  const subtotalD = typeRows.reduce((s, r) => s + r.totalDebit,  0);
                  const subtotalC = typeRows.reduce((s, r) => s + r.totalCredit, 0);
                  const subtotalB = typeRows.reduce((s, r) => s + r.balance,     0);
                  return (
                    <>
                      {/* Cabecera de tipo */}
                      <tr key={`h-${type}`} className="bg-slate-50 border-t">
                        <td colSpan={5} className="py-1.5 px-3">
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TYPE_COLOR[type] ?? ""}`}>
                            {type}
                          </span>
                        </td>
                      </tr>

                      {/* Filas de cuentas */}
                      {typeRows.map(row => (
                        <tr key={row.accountId} className="border-t hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-mono text-xs text-slate-500">{row.accountCode}</td>
                          <td className="py-2 px-3">{row.accountName}</td>
                          <td className="py-2 px-3 text-right font-mono text-blue-700">
                            {row.totalDebit > 0 ? fmt(row.totalDebit) : ""}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700">
                            {row.totalCredit > 0 ? fmt(row.totalCredit) : ""}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-semibold ${row.balance < 0 ? "text-red-600" : "text-slate-700"}`}>
                            {fmt(row.balance)}
                          </td>
                        </tr>
                      ))}

                      {/* Subtotal de tipo */}
                      <tr key={`s-${type}`} className="border-t border-slate-200 bg-slate-50/80">
                        <td colSpan={2} className="py-1.5 px-3 text-xs font-semibold text-slate-500">
                          Subtotal {type}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-blue-700 text-xs">{fmt(subtotalD)}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-700 text-xs">{fmt(subtotalC)}</td>
                        <td className={`py-1.5 px-3 text-right font-mono font-semibold text-xs ${subtotalB < 0 ? "text-red-600" : "text-slate-700"}`}>
                          {fmt(subtotalB)}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-400 bg-slate-100">
                  <td colSpan={2} className="py-2.5 px-3 font-bold text-slate-700 text-xs uppercase tracking-wider">
                    TOTALES GENERALES
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800">{fmt(totals.totalDebit)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">{fmt(totals.totalCredit)}</td>
                  <td className="py-2.5 px-3 text-right">
                    {balanced ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
                    ) : (
                      <span className="font-mono font-bold text-red-600 text-xs">
                        {fmt(Math.abs(totals.totalDebit - totals.totalCredit))}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
