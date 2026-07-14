"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ReportExportBar } from "@/components/ui/report-export-bar";
import { exportToExcel } from "@/lib/export-excel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const fmt = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmt.format(Math.round(n));

type Row = { month: string; monthNo: number; sales: number; collected: number };

export default function VentasVsCobroPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<Row[]>(`/reports/sales-vs-collections?year=${year}`)
      .then((r) => setData(r.data ?? []))
      .finally(() => setLoading(false));
  }, [year]);

  const totalVentas   = data.reduce((s, r) => s + r.sales, 0);
  const totalCobros   = data.reduce((s, r) => s + r.collected, 0);
  const diferencia    = totalVentas - totalCobros;

  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ventas vs Cobros</h1>
          <p className="text-sm text-gray-500 mt-1">Comparativa mensual de facturación y cobranza</p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <ReportExportBar
            disabled={loading}
            onExcel={() =>
              exportToExcel(
                data.map((r) => ({
                  Mes: r.month,
                  Ventas: r.sales,
                  Cobros: r.collected,
                  Diferencia: r.sales - r.collected,
                })),
                `Ventas_vs_Cobros_${year}`
              )
            }
          />
          <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total facturado", value: totalVentas, color: "text-[#2563eb]" },
          { label: "Total cobrado",   value: totalCobros, color: "text-emerald-600" },
          { label: "Diferencia (pendiente)", value: diferencia, color: diferencia > 0 ? "text-red-600" : "text-emerald-600" },
        ].map((k) => (
          <Card key={k.label} className="p-5 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>₲ {money(k.value)}</div>
          </Card>
        ))}
      </div>

      {/* Barras */}
      <Card className="p-5 shadow-sm">
        <div className="font-semibold text-gray-900 mb-4">Por mes — {year}</div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Cargando…</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`₲ ${money(Number(v ?? 0))}`, ""]} labelStyle={{ fontWeight: 600 }} />
              <Legend />
              <Bar dataKey="sales"     name="Ventas"  fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Cobros"  fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Línea acumulada */}
      <Card className="p-5 shadow-sm">
        <div className="font-semibold text-gray-900 mb-4">Acumulado anual</div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Cargando…</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={data.reduce<(Row & { accSales: number; accCollected: number })[]>((acc, row) => {
                const prev = acc[acc.length - 1];
                acc.push({
                  ...row,
                  accSales:     (prev?.accSales ?? 0) + row.sales,
                  accCollected: (prev?.accCollected ?? 0) + row.collected,
                });
                return acc;
              }, [])}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`₲ ${money(Number(v ?? 0))}`, ""]} labelStyle={{ fontWeight: 600 }} />
              <Legend />
              <Line type="monotone" dataKey="accSales"     name="Ventas acum."  stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="accCollected" name="Cobros acum."  stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tabla detalle */}
      <Card className="p-5 shadow-sm overflow-auto">
        <div className="font-semibold text-gray-900 mb-4">Detalle mensual</div>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 border-b">Mes</th>
              <th className="px-3 py-2 border-b text-right">Ventas</th>
              <th className="px-3 py-2 border-b text-right">Cobros</th>
              <th className="px-3 py-2 border-b text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const diff = r.sales - r.collected;
              return (
                <tr key={r.monthNo} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.month}</td>
                  <td className="px-3 py-2 text-right">₲ {money(r.sales)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">₲ {money(r.collected)}</td>
                  <td className={`px-3 py-2 text-right ${diff > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    ₲ {money(diff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">₲ {money(totalVentas)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">₲ {money(totalCobros)}</td>
              <td className={`px-3 py-2 text-right ${diferencia > 0 ? "text-red-600" : "text-emerald-600"}`}>
                ₲ {money(diferencia)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}
