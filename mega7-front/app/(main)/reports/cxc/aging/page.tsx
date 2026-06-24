"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ReportExportBar } from "@/components/ui/report-export-bar";
import { exportToExcel } from "@/lib/export-excel";

const fmt = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmt.format(Math.round(n));

type AgingRow = {
  customerId: number;
  customerName: string;
  corriente: number;
  dias1_30: number;
  dias31_60: number;
  dias61_90: number;
  diasMas90: number;
  total: number;
};

const BUCKETS = [
  { key: "corriente" as const,  label: "Corriente",   color: "bg-emerald-100 text-emerald-800" },
  { key: "dias1_30" as const,   label: "1–30 días",   color: "bg-amber-100 text-amber-800" },
  { key: "dias31_60" as const,  label: "31–60 días",  color: "bg-orange-100 text-orange-800" },
  { key: "dias61_90" as const,  label: "61–90 días",  color: "bg-red-100 text-red-700" },
  { key: "diasMas90" as const,  label: "+90 días",    color: "bg-red-200 text-red-800" },
];

export default function AgingCxCPage() {
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<AgingRow[]>("/reports/aging-cxc")
      .then((r) => setRows(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) =>
    r.customerName.toLowerCase().includes(search.toLowerCase())
  );

  // Totales por bucket
  const totals = BUCKETS.reduce(
    (acc, b) => ({ ...acc, [b.key]: filtered.reduce((s, r) => s + r[b.key], 0) }),
    {} as Record<string, number>
  );
  const grandTotal = filtered.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Aging de CxC</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cuentas por cobrar clasificadas por antigüedad de vencimiento
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <ReportExportBar
            disabled={loading}
            onExcel={() =>
              exportToExcel(
                filtered.map((r) => ({
                  Cliente: r.customerName,
                  Corriente: r.corriente,
                  "1-30 días": r.dias1_30,
                  "31-60 días": r.dias31_60,
                  "61-90 días": r.dias61_90,
                  "+90 días": r.diasMas90,
                  Total: r.total,
                })),
                "Aging_CxC"
              )
            }
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="no-print border rounded-lg px-3 py-2 text-sm bg-white w-56 focus:outline-none focus:ring-2 focus:ring-[#C5A05A]"
          />
        </div>
      </div>

      {/* KPI buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {BUCKETS.map((b) => (
          <Card key={b.key} className="p-4 shadow-sm">
            <div className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2 ${b.color}`}>
              {b.label}
            </div>
            <div className="text-lg font-bold text-gray-900">
              ₲ {money(totals[b.key] ?? 0)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {filtered.filter((r) => r[b.key] > 0).length} clientes
            </div>
          </Card>
        ))}
      </div>

      {/* Tabla */}
      <Card className="shadow-sm overflow-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No hay cuentas por cobrar pendientes.</div>
        ) : (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 border-b font-medium text-gray-600">Cliente</th>
                {BUCKETS.map((b) => (
                  <th key={b.key} className="px-4 py-3 border-b text-right font-medium text-gray-600">
                    {b.label}
                  </th>
                ))}
                <th className="px-4 py-3 border-b text-right font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.customerId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{r.customerName}</td>
                  {BUCKETS.map((b) => (
                    <td
                      key={b.key}
                      className={`px-4 py-2.5 text-right ${r[b.key] > 0 ? "" : "text-gray-300"}`}
                    >
                      {r[b.key] > 0 ? `₲ ${money(r[b.key])}` : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-bold">₲ {money(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3">Total ({filtered.length} clientes)</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className="px-4 py-3 text-right">
                    ₲ {money(totals[b.key] ?? 0)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-[#C5A05A]">₲ {money(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}
