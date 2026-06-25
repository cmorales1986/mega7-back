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
import { Layers, RefreshCcw, Printer, CheckCircle2, AlertTriangle } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AccountLine = {
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
};

type BSData = {
  asOfDate: string;
  assets: AccountLine[];
  liabilities: AccountLine[];
  equity: AccountLine[];
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// ── Columna del balance ───────────────────────────────────────────────────────

function BSColumn({
  title, color, rows, subtotals,
}: {
  title: string;
  color: string;
  rows: { label: string; lines: AccountLine[]; total: number; emptyMsg: string }[];
  subtotals?: { label: string; amount: number; highlight?: boolean }[];
}) {
  return (
    <div className="flex-1 min-w-72 rounded-xl border overflow-hidden">
      {/* Encabezado de columna */}
      <div className={`${color} px-4 py-2.5`}>
        <span className="text-sm font-bold uppercase tracking-wider">{title}</span>
      </div>

      {rows.map((section, si) => (
        <div key={si}>
          {/* Sección */}
          <div className="px-4 pt-3 pb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {section.label}
            </span>
          </div>

          {section.lines.length === 0 ? (
            <div className="px-4 pb-2 text-sm text-slate-400 italic">{section.emptyMsg}</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {section.lines.map(r => (
                  <tr key={r.accountId} className="border-t hover:bg-slate-50/60">
                    <td className="py-1.5 px-4 font-mono text-xs text-slate-500 w-32">{r.accountCode}</td>
                    <td className="py-1.5 px-4 text-slate-700">{r.accountName}</td>
                    <td className="py-1.5 px-4 text-right font-mono">{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Subtotal de sección */}
          <div className="flex justify-between px-4 py-2 border-t border-dashed border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total {section.label}</span>
            <span className="font-mono font-semibold text-slate-700">{fmt(section.total)}</span>
          </div>
        </div>
      ))}

      {/* Subtotales finales */}
      {subtotals?.map((s, i) => (
        <div key={i}
          className={`flex justify-between px-4 py-2.5 border-t-2 border-slate-300 font-bold
            ${s.highlight ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-800"}`}
        >
          <span className="text-xs uppercase tracking-wider">{s.label}</span>
          <span className="font-mono">{fmt(s.amount)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);
  const [data,    setData]    = useState<BSData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BSData>(`/accountingreports/balance-sheet?asOf=${asOf}`);
      setData(res.data);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el balance general"), "error");
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  const balanced = data
    ? Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) < 0.01
    : true;

  return (
    <PageShell
      title="Balance General"
      icon={<Layers className="h-6 w-6 text-emerald-600" />}
      subtitle="Estado de situación patrimonial. Activo = Pasivo + Patrimonio."
      chips={
        data ? (
          <Chip tone={balanced ? "ok" : "warn"}>
            {balanced
              ? "Balance cuadrado"
              : `Descuadre: ${fmt(Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity))}`}
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
        {/* Filtro de fecha */}
        <div className="flex items-center gap-3 mb-5 no-print">
          <span className="text-sm text-slate-500 whitespace-nowrap">Al:</span>
          <Input type="date" className="w-40 bg-white" value={asOf}
            onChange={e => setAsOf(e.target.value)} />
        </div>

        <Separator className="mb-4" />

        {loading ? (
          <div className="py-20 text-center text-slate-400">Cargando…</div>
        ) : !data ? null : (
          <>
            {/* Indicador de cuadre */}
            <div className={`flex items-center gap-2 mb-4 text-sm font-semibold
              ${balanced ? "text-emerald-700" : "text-red-700"}`}>
              {balanced
                ? <CheckCircle2 className="h-4 w-4" />
                : <AlertTriangle className="h-4 w-4" />}
              {balanced
                ? `Balance cuadrado al ${new Date(asOf).toLocaleDateString("es-PY")}`
                : `El balance no cuadra — diferencia: ${fmt(Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity))}`}
            </div>

            {/* Columnas */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* ACTIVO */}
              <BSColumn
                title="Activo"
                color="bg-blue-600 text-white"
                rows={[{
                  label: "Activo",
                  lines: data.assets,
                  total: data.totalAssets,
                  emptyMsg: "Sin activos registrados.",
                }]}
                subtotals={[{ label: "Total Activo", amount: data.totalAssets, highlight: true }]}
              />

              {/* PASIVO + PATRIMONIO */}
              <BSColumn
                title="Pasivo y Patrimonio"
                color="bg-slate-700 text-white"
                rows={[
                  {
                    label: "Pasivo",
                    lines: data.liabilities,
                    total: data.totalLiabilities,
                    emptyMsg: "Sin pasivos registrados.",
                  },
                  {
                    label: "Patrimonio",
                    lines: [
                      ...data.equity,
                      // Utilidad del ejercicio como línea especial
                      ...(data.retainedEarnings !== 0 ? [{
                        accountId: -1,
                        accountCode: "—",
                        accountName: data.retainedEarnings >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio",
                        amount: data.retainedEarnings,
                      }] : []),
                    ],
                    total: data.totalEquity,
                    emptyMsg: "Sin patrimonio registrado.",
                  },
                ]}
                subtotals={[
                  { label: "Total Pasivo", amount: data.totalLiabilities },
                  { label: "Total Patrimonio", amount: data.totalEquity },
                  { label: "Total Pasivo + Patrimonio", amount: data.totalLiabilitiesAndEquity, highlight: true },
                ]}
              />
            </div>
          </>
        )}
      </Card>
    </PageShell>
  );
}
