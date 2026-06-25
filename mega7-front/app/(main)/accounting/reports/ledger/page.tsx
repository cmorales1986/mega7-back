"use client";

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageShell } from "@/components/ui/page-shell";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BookText, RefreshCcw, Printer } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type FlatAccount = {
  id: number; code: string; name: string; isTitle: boolean; isActive: boolean; type: string;
};

type LedgerRow = {
  date: string;
  entryId: number;
  desc: string;
  reference: string | null;
  source: string;
  lineDesc: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

type LedgerData = {
  account: { id: number; code: string; name: string; type: string; nature: string };
  openingBalance: number;
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

const SOURCE_LABEL: Record<string, string> = {
  Manual: "Manual", Venta: "Venta", Compra: "Compra",
  Pago: "Pago", Cobro: "Cobro", Banco: "Banco", Caja: "Caja", Ajuste: "Ajuste",
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function LedgerPage() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstOfYear = `${now.getFullYear()}-01-01`;

  const [accounts,    setAccounts]    = useState<FlatAccount[]>([]);
  const [accountId,   setAccountId]   = useState<string>("");
  const [from, setFrom] = useState(firstOfYear);
  const [to,   setTo]   = useState(today);
  const [data,    setData]    = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar lista de cuentas para el selector
  useEffect(() => {
    api.get<FlatAccount[]>("/accounts/flat?activeOnly=true")
      .then(r => setAccounts((r.data ?? []).filter(a => !a.isTitle)))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ accountId, from, to });
      const res = await api.get<LedgerData>(`/accountingreports/ledger?${p}`);
      setData(res.data);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el libro mayor"), "error");
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageShell
      title="Libro Mayor"
      icon={<BookText className="h-6 w-6 text-emerald-600" />}
      subtitle="Movimientos por cuenta con saldo acumulado."
      right={
        <div className="flex gap-2 no-print">
          <Button variant="outline" className="bg-white" onClick={load} disabled={loading || !accountId}>
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
          <div className="flex items-center gap-2 flex-1 min-w-64">
            <span className="text-sm text-slate-500 whitespace-nowrap">Cuenta:</span>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-white flex-1">
                <SelectValue placeholder="Seleccionar cuenta…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {accounts.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <span className="font-mono text-xs text-slate-500 mr-2">{a.code}</span>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

        {!accountId ? (
          <div className="py-20 text-center text-slate-400">Seleccioná una cuenta para ver sus movimientos.</div>
        ) : loading ? (
          <div className="py-20 text-center text-slate-400">Cargando…</div>
        ) : !data ? null : (
          <>
            {/* Cabecera de la cuenta */}
            <div className="mb-4 flex items-baseline gap-3">
              <span className="font-mono text-lg font-bold text-slate-700">{data.account.code}</span>
              <span className="text-lg font-semibold">{data.account.name}</span>
              <span className="text-xs text-slate-500 ml-1">({data.account.type} · {data.account.nature})</span>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide border-b">
                    <th className="py-2 px-3 text-left w-28">Fecha</th>
                    <th className="py-2 px-3 text-left w-20">Asiento</th>
                    <th className="py-2 px-3 text-left">Descripción</th>
                    <th className="py-2 px-3 text-left w-20">Origen</th>
                    <th className="py-2 px-3 text-right w-32">Debe</th>
                    <th className="py-2 px-3 text-right w-32">Haber</th>
                    <th className="py-2 px-3 text-right w-36">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Saldo inicial */}
                  <tr className="border-t bg-slate-50 italic">
                    <td colSpan={6} className="py-2 px-3 text-xs text-slate-500 font-medium">
                      Saldo inicial
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-600">
                      {fmt(data.openingBalance)}
                    </td>
                  </tr>

                  {data.rows.length === 0 ? (
                    <tr className="border-t">
                      <td colSpan={7} className="py-8 text-center text-slate-400">Sin movimientos en el período.</td>
                    </tr>
                  ) : data.rows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-mono text-xs text-slate-500">{fmtDate(row.date)}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-500">#{row.entryId}</td>
                      <td className="py-2 px-3">
                        <div className="font-medium truncate max-w-xs">{row.desc}</div>
                        {row.lineDesc && (
                          <div className="text-xs text-slate-400 truncate">{row.lineDesc}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                          {SOURCE_LABEL[row.source] ?? row.source}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-700">
                        {row.debit > 0 ? fmt(row.debit) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">
                        {row.credit > 0 ? fmt(row.credit) : ""}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-semibold ${row.runningBalance < 0 ? "text-red-600" : "text-slate-700"}`}>
                        {fmt(row.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Totales del período */}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={4} className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                      Totales del período
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">{fmt(data.totalDebit)}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">{fmt(data.totalCredit)}</td>
                    <td />
                  </tr>
                  {/* Saldo final */}
                  <tr className="border-t-2 border-slate-400 bg-slate-100">
                    <td colSpan={6} className="py-2.5 px-3 font-bold text-slate-700 text-xs uppercase tracking-wider">
                      SALDO FINAL
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${data.closingBalance < 0 ? "text-red-700" : "text-slate-800"}`}>
                      {fmt(data.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </PageShell>
  );
}
