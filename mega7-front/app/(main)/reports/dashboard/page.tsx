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
} from "recharts";
import { TrendingUp, HandCoins, AlertTriangle, ReceiptText } from "lucide-react";

const fmt = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmt.format(Math.round(n));

type SalesVsCollections = {
  month: string;
  monthNo: number;
  sales: number;
  collected: number;
};

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

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="p-5 flex gap-4 items-start shadow-sm">
      <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </Card>
  );
}

export default function DashboardReportPage() {
  const year = new Date().getFullYear();
  const [chart, setChart] = useState<SalesVsCollections[]>([]);
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<SalesVsCollections[]>(`/reports/sales-vs-collections?year=${year}`),
      api.get<AgingRow[]>("/reports/aging-cxc"),
    ]).then(([c, a]) => {
      setChart(c.data ?? []);
      setAging(a.data ?? []);
    }).finally(() => setLoading(false));
  }, [year]);

  const currentMonth = new Date().getMonth() + 1;
  const monthData = chart.find((m) => m.monthNo === currentMonth);
  const ventasMes = monthData?.sales ?? 0;
  const cobrosMes = monthData?.collected ?? 0;

  const totalCxC = aging.reduce((s, r) => s + r.total, 0);
  const totalVencido = aging.reduce(
    (s, r) => s + r.dias1_30 + r.dias31_60 + r.dias61_90 + r.diasMas90,
    0
  );

  const top5 = [...aging].sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard Ejecutivo</h1>
          <p className="text-sm text-gray-500 mt-1">Visibilidad general del negocio — {year}</p>
        </div>
        <ReportExportBar
          disabled={loading}
          onExcel={() =>
            exportToExcel(
              chart.map((r) => ({
                Mes: r.month,
                Ventas: r.sales,
                Cobros: r.collected,
              })),
              `Dashboard_${year}`
            )
          }
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={20} className="text-white" />}
          label="Ventas del mes"
          value={`₲ ${money(ventasMes)}`}
          color="bg-[#C5A05A]"
        />
        <KpiCard
          icon={<HandCoins size={20} className="text-white" />}
          label="Cobros del mes"
          value={`₲ ${money(cobrosMes)}`}
          color="bg-emerald-500"
        />
        <KpiCard
          icon={<ReceiptText size={20} className="text-white" />}
          label="CxC pendiente"
          value={`₲ ${money(totalCxC)}`}
          sub={`${aging.length} clientes`}
          color="bg-blue-500"
        />
        <KpiCard
          icon={<AlertTriangle size={20} className="text-white" />}
          label="CxC vencida"
          value={`₲ ${money(totalVencido)}`}
          color="bg-red-500"
        />
      </div>

      {/* Gráfico ventas vs cobros */}
      <Card className="p-5 shadow-sm">
        <div className="mb-4">
          <div className="font-semibold text-gray-900">Ventas vs Cobros — {year}</div>
          <div className="text-xs text-gray-500">Comparativa mensual facturado / cobrado</div>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            Cargando…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => [`₲ ${money(Number(v ?? 0))}`, ""]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Bar dataKey="sales" name="Ventas" fill="#C5A05A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Cobros" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Top 5 clientes */}
      <Card className="p-5 shadow-sm">
        <div className="mb-4">
          <div className="font-semibold text-gray-900">Top 5 — Mayor saldo pendiente</div>
          <div className="text-xs text-gray-500">Clientes con mayor CxC abierta</div>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400">Cargando…</div>
        ) : top5.length === 0 ? (
          <div className="text-sm text-gray-400">Sin deudas pendientes.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="pb-2 text-gray-500 font-medium">Cliente</th>
                <th className="pb-2 text-right text-gray-500 font-medium">Corriente</th>
                <th className="pb-2 text-right text-gray-500 font-medium">Vencido</th>
                <th className="pb-2 text-right text-gray-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((r) => {
                const vencido = r.dias1_30 + r.dias31_60 + r.dias61_90 + r.diasMas90;
                return (
                  <tr key={r.customerId} className="border-b last:border-0">
                    <td className="py-2">{r.customerName}</td>
                    <td className="py-2 text-right text-emerald-700">₲ {money(r.corriente)}</td>
                    <td className="py-2 text-right text-red-600">₲ {money(vencido)}</td>
                    <td className="py-2 text-right font-semibold">₲ {money(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
