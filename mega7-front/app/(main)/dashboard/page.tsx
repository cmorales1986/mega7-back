"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  Wallet,
  Landmark,
  ArrowRight,
  TrendingUp,
  Users,
  ReceiptText,
  AlertTriangle,
  BarChart3,
  RefreshCcw,
} from "lucide-react";

import { toErrorMsg } from "@/lib/api-error";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type BankBalanceRow = {
  accountId: number;
  bankName: string;
  alias: string;
  currency: string;
  currentBalance: number;
  isActive: boolean;
};

type KpiResponse = {
  arTotal: number;
  apTotal: number;
  overdueCustomers: number;
  salesThisMonth: number;
};

type SalesVsCollectionsRow = {
  month: string; // Ene..Dic
  monthNo: number; // 1..12
  sales: number; // facturado
  collected: number; // cobrado
};

const fmtPY = new Intl.NumberFormat("es-PY");

// 🎨 Mega7
const BAR_COLOR = "#2563eb";
const LINE_COLOR = "#2563EB";

// años disponibles (como pediste)
const YEAR_OPTIONS = [2025, 2026];

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info" | "danger";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  hint,
  tone = "purple",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: "purple" | "emerald" | "amber" | "sky" | "rose";
}) {
  const toneCls =
    tone === "emerald"
      ? "from-emerald-50 to-white border-emerald-200"
      : tone === "amber"
      ? "from-amber-50 to-white border-amber-200"
      : tone === "sky"
      ? "from-sky-50 to-white border-sky-200"
      : tone === "rose"
      ? "from-rose-50 to-white border-rose-200"
      : "from-purple-50 to-white border-purple-200";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <Card
        className={`p-5 shadow-sm border bg-gradient-to-br ${toneCls} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
            {hint ? (
              <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
            ) : null}
          </div>
          <div className="rounded-xl border bg-white p-2 shadow-sm">{icon}</div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);

  // ===== Banks (real)
  const [bankRows, setBankRows] = useState<BankBalanceRow[]>([]);

  // ===== KPIs (real)
  const [kpi, setKpi] = useState<KpiResponse>({
    arTotal: 0,
    apTotal: 0,
    overdueCustomers: 0,
    salesThisMonth: 0,
  });

  // ===== Chart (real)
  const [chartLoading, setChartLoading] = useState(false);
  const [salesData, setSalesData] = useState<SalesVsCollectionsRow[]>([]);

  // ✅ selector de año
  const [year, setYear] = useState<number>(() => {
    const y = new Date().getFullYear();
    return YEAR_OPTIONS.includes(y) ? y : 2026;
  });

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of bankRows.filter((x) => x.isActive)) {
      map.set(
        r.currency,
        (map.get(r.currency) ?? 0) + Number(r.currentBalance ?? 0)
      );
    }
    return Array.from(map.entries()).map(([currency, total]) => ({
      currency,
      total,
    }));
  }, [bankRows]);

  const topBankAccounts = useMemo(() => {
    const active = bankRows.filter((x) => x.isActive);
    return [...active]
      .sort((a, b) => (b.currentBalance ?? 0) - (a.currentBalance ?? 0))
      .slice(0, 4);
  }, [bankRows]);

  const loadChart = async (y = year) => {
    setChartLoading(true);
    try {
      const res = await api.get("/reports/sales-vs-collections", {
        params: { year: y },
      });

      const data = Array.isArray(res.data)
        ? (res.data as SalesVsCollectionsRow[])
        : [];

      setSalesData(data);
    } catch (e: any) {
      console.error(e);
      setSalesData([]);
    } finally {
      setChartLoading(false);
    }
  };

  const safeGet = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
      const res = await api.get<T>(url);
      return res.data ?? fallback;
    } catch (e: any) {
      // 403 = sin permiso → devolver vacío silenciosamente
      if (e?.response?.status === 403 || e?.response?.status === 401) return fallback;
      throw e;
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [banks, kpiData] = await Promise.all([
        safeGet<BankBalanceRow[]>("/banks/accounts/balances", []),
        safeGet<KpiResponse>("/dashboard/kpis", {
          arTotal: 0,
          apTotal: 0,
          overdueCustomers: 0,
          salesThisMonth: 0,
        }),
      ]);

      setBankRows(Array.isArray(banks) ? banks : []);
      setKpi({
        arTotal: Number(kpiData?.arTotal ?? 0),
        apTotal: Number(kpiData?.apTotal ?? 0),
        overdueCustomers: Number(kpiData?.overdueCustomers ?? 0),
        salesThisMonth: Number(kpiData?.salesThisMonth ?? 0),
      });
    } catch (e: any) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar el dashboard"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ al cambiar año -> recarga chart
  useEffect(() => {
    loadChart(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const totalPYG = totalsByCurrency.find((x) => x.currency === "PYG")?.total ?? 0;
  const totalUSD = totalsByCurrency.find((x) => x.currency === "USD")?.total ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Dashboard</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Resumen financiero del sistema: bancos, ventas, CxC/CxP y morosidad.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">
                <Landmark className="h-3.5 w-3.5" />
                Bancos: {fmtPY.format(Math.round(totalPYG))} PYG
              </Chip>

              {totalUSD > 0 ? (
                <Chip tone="neutral">
                  USD:{" "}
                  {new Intl.NumberFormat("en-US").format(Math.round(totalUSD))}
                </Chip>
              ) : null}

              {kpi.overdueCustomers > 0 ? (
                <Chip tone="warn">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Morosos: {kpi.overdueCustomers}
                </Chip>
              ) : (
                <Chip tone="ok">Morosidad OK</Chip>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ✅ Selector Año */}
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
              <span className="text-xs font-medium text-slate-600">Año</span>
              <select
                className="text-sm outline-none bg-transparent"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              className="bg-white"
              onClick={() => loadChart(year)}
              disabled={chartLoading}
              title="Refrescar gráfico"
            >
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${chartLoading ? "animate-spin" : ""}`}
              />
              Gráfico
            </Button>

            <Button
              variant="outline"
              className="bg-white"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refrescar
            </Button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Bancos (PYG)"
          value={fmtPY.format(Math.round(totalPYG))}
          hint="Total disponible (según movimientos)"
          icon={<Landmark className="h-5 w-5 text-purple-600" />}
          tone="purple"
        />

        <StatCard
          title="Ventas del mes"
          value={fmtPY.format(Math.round(kpi.salesThisMonth))}
          hint="Total facturado (mes actual)"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          tone="emerald"
        />

        <StatCard
          title="Cuentas a Cobrar"
          value={fmtPY.format(Math.round(kpi.arTotal))}
          hint="Saldo pendiente total"
          icon={<ReceiptText className="h-5 w-5 text-sky-600" />}
          tone="sky"
        />

        <StatCard
          title="Morosos"
          value={String(kpi.overdueCustomers)}
          hint="Clientes con facturas vencidas"
          icon={<Users className="h-5 w-5 text-amber-600" />}
          tone="amber"
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* BANKS MINI */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Landmark className="h-4 w-4 text-purple-600" />
                Bancos (mini)
              </div>

              <Link href="/banks">
                <Button variant="outline" className="bg-white">
                  Ir a Bancos <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              {topBankAccounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No hay cuentas activas o no se pudo cargar.
                </div>
              ) : (
                topBankAccounts.map((r) => {
                  const neg = (r.currentBalance ?? 0) < 0;
                  return (
                    <motion.div
                      key={r.accountId}
                      whileHover={{ x: 3 }}
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 22,
                      }}
                      className="rounded-xl border bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{r.bankName}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.alias} · {r.currency}
                          </div>
                        </div>

                        <div
                          className={`text-sm font-semibold ${
                            neg ? "text-rose-600" : "text-slate-900"
                          }`}
                        >
                          {r.currency === "USD"
                            ? new Intl.NumberFormat("en-US").format(
                                Math.round(r.currentBalance ?? 0)
                              )
                            : fmtPY.format(Math.round(r.currentBalance ?? 0))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {totalsByCurrency.length > 0 ? (
              <>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-2">
                  {totalsByCurrency.map((t) => (
                    <Chip key={t.currency} tone="neutral">
                      {t.currency}:{" "}
                      {t.currency === "USD"
                        ? new Intl.NumberFormat("en-US").format(
                            Math.round(t.total)
                          )
                        : fmtPY.format(Math.round(t.total))}
                    </Chip>
                  ))}
                </div>
              </>
            ) : null}
          </Card>
        </motion.div>

        {/* CHART: Ventas (barra) vs Cobros (línea) */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                Ventas vs Cobros por Mes ({year})
              </div>

              <Chip tone="info">
                {chartLoading ? "Cargando…" : "Ventas (barra) / Cobros (línea)"}
              </Chip>
            </div>

            <Separator className="my-4" />

            <div className="h-[320px] w-full">
              {salesData.length === 0 && !chartLoading ? (
                <div className="text-sm text-muted-foreground">
                  No hay datos para mostrar (o no se pudo cargar el reporte).
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis
                      tickFormatter={(v) => fmtPY.format(Number(v || 0))}
                      width={90}
                    />

                    <Tooltip
                      formatter={(v: any) => fmtPY.format(Number(v || 0))}
                      labelFormatter={(lbl) => `Mes: ${lbl}`}
                    />

                    {/* 🟨 Barra dorada Mega7 */}
                    <Bar
                      dataKey="sales"
                      name="Ventas (facturado)"
                      fill={BAR_COLOR}
                      fillOpacity={0.9}
                      radius={[10, 10, 0, 0]}
                      activeBar={{ fill: BAR_COLOR, fillOpacity: 1 }}
                    />

                    {/* 🔵 Línea cobrado con dot condicional */}
                    <Line
                      type="monotone"
                      dataKey="collected"
                      name="Cobros (cobrado)"
                      stroke={LINE_COLOR}
                      strokeWidth={3}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const val = Number(payload?.collected ?? 0);
                        if (!val || val <= 0) return null;

                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill={LINE_COLOR}
                            stroke="white"
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* NEXT BLOCKS PLACEHOLDERS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 p-5 shadow-sm">
          <div className="font-semibold">Cuentas a Cobrar (próximo)</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Lista de facturas abiertas + vencidas, total balance y top morosos.
          </div>
        </Card>

        <Card className="border-slate-200 p-5 shadow-sm">
          <div className="font-semibold">Cuentas a Pagar (próximo)</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Proveedores con saldo, vencimientos, pagos recientes.
          </div>
        </Card>

        <Card className="border-slate-200 p-5 shadow-sm">
          <div className="font-semibold">Alertas (próximo)</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Saldo negativo, periodos cerrados, facturas vencidas, etc.
          </div>
        </Card>
      </div>
    </div>
  );
}
