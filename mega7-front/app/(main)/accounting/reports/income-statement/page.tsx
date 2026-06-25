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
import { TrendingUp, TrendingDown, RefreshCcw, Printer } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AccountLine = {
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
};

type ISData = {
  revenues: AccountLine[];
  costs: AccountLine[];
  expenses: AccountLine[];
  totalRevenues: number;
  totalCosts: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// ── Sub-tabla de cuentas ──────────────────────────────────────────────────────

function AccountTable({
  rows, emptyMsg,
}: { rows: AccountLine[]; emptyMsg: string }) {
  if (rows.length === 0) {
    return <div className="py-3 px-4 text-sm text-slate-400 italic">{emptyMsg}</div>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(r => (
          <tr key={r.accountId} className="border-t hover:bg-slate-50/60">
            <td className="py-1.5 px-4 font-mono text-xs text-slate-500 w-36">{r.accountCode}</td>
            <td className="py-1.5 px-4">{r.accountName}</td>
            <td className="py-1.5 px-4 text-right font-mono">{fmt(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Fila de subtotal / resultado ──────────────────────────────────────────────

function ResultRow({
  label, amount, highlight = false, double = false,
}: { label: string; amount: number; highlight?: boolean; double?: boolean }) {
  const positive = amount >= 0;
  const base = "flex justify-between items-center px-4 py-2 font-semibold text-sm";
  const cls = highlight
    ? `${base} ${positive ? "bg-emerald-600 text-white" : "bg-red-600 text-white"} rounded-lg mx-2 my-1`
    : `${base} border-t ${double ? "border-t-2 border-slate-400" : "border-slate-200"} bg-slate-50`;

  return (
    <div className={cls}>
      <span className="uppercase tracking-wide text-xs">{label}</span>
      <span className={`font-mono ${!highlight && !positive ? "text-red-600" : ""}`}>
        {fmt(amount)}
      </span>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function IncomeStatementPage() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstOfYear = `${now.getFullYear()}-01-01`;

  const [from, setFrom] = useState(firstOfYear);
  const [to,   setTo]   = useState(today);
  const [data,    setData]    = useState<ISData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to)   p.set("to",   to);
      const res = await api.get<ISData>(`/accountingreports/income-statement?${p}`);
      setData(res.data);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el estado de resultados"), "error");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const netPositive = (data?.netProfit ?? 0) >= 0;

  return (
    <PageShell
      title="Estado de Resultados"
      icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
      subtitle="Ingresos, costos y gastos del período. Refleja la utilidad o pérdida neta."
      chips={
        data ? (
          <Chip tone={netPositive ? "ok" : "warn"}>
            {netPositive ? "Utilidad" : "Pérdida"}: {fmt(Math.abs(data.netProfit))}
          </Chip>
        ) : undefined
      }
      right={
        <div className="flex gap-2 no-print">
          <Button variant="outline" className="bg-white" onClick={load} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
          <Button variant="outline" className="bg-white" onClick={() => window.print()} disabled={!data}>
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
        ) : !data ? null : (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* ── INGRESOS ─────────────────────────────────────────────────── */}
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-emerald-50 px-4 py-2 border-b">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Ingresos
                </span>
              </div>
              <AccountTable rows={data.revenues} emptyMsg="Sin ingresos en el período." />
              <ResultRow label="Total Ingresos" amount={data.totalRevenues} double />
            </div>

            {/* ── COSTOS ───────────────────────────────────────────────────── */}
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 border-b">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Costo de Ventas
                </span>
              </div>
              <AccountTable rows={data.costs} emptyMsg="Sin costos registrados." />
              <ResultRow label="Total Costos" amount={data.totalCosts} double />
            </div>

            {/* ── UTILIDAD BRUTA ───────────────────────────────────────────── */}
            <div className={`rounded-xl border px-4 py-3 flex justify-between items-center font-bold
              ${data.grossProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <span className="text-sm uppercase tracking-wide text-slate-700">Utilidad Bruta</span>
              <span className={`font-mono text-lg ${data.grossProfit < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {fmt(data.grossProfit)}
              </span>
            </div>

            {/* ── GASTOS ───────────────────────────────────────────────────── */}
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-orange-50 px-4 py-2 border-b">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-700">
                  Gastos Operativos
                </span>
              </div>
              <AccountTable rows={data.expenses} emptyMsg="Sin gastos registrados." />
              <ResultRow label="Total Gastos" amount={data.totalExpenses} double />
            </div>

            {/* ── UTILIDAD NETA ─────────────────────────────────────────────── */}
            <div className={`rounded-xl px-5 py-4 flex justify-between items-center font-bold shadow
              ${netPositive ? "bg-emerald-600" : "bg-red-600"} text-white`}>
              <div className="flex items-center gap-2">
                {netPositive
                  ? <TrendingUp className="h-5 w-5" />
                  : <TrendingDown className="h-5 w-5" />}
                <span className="text-sm uppercase tracking-widest">
                  {netPositive ? "Utilidad Neta" : "Pérdida Neta"}
                </span>
              </div>
              <span className="font-mono text-2xl font-bold">
                {fmt(Math.abs(data.netProfit))}
              </span>
            </div>

          </div>
        )}
      </Card>
    </PageShell>
  );
}
