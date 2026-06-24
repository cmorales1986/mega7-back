"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { TrendingUp, HandCoins, FileText, AlertTriangle } from "lucide-react";

const fmt = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmt.format(Math.round(n));

type ResumenDia = {
  date: string;
  totalFacturado: number;
  cantFacturas: number;
  totalCobrado: number;
  cantCobros: number;
  facturasVencidas: number;
};

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
  textColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  textColor?: string;
}) {
  return (
    <Card className="p-5 flex gap-4 items-start shadow-sm">
      <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${textColor ?? "text-gray-900"}`}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </Card>
  );
}

export default function ResumenDiaPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<ResumenDia | null>(null);
  const [loading, setLoading] = useState(false);

  const load = (d: string) => {
    setLoading(true);
    api
      .get<ResumenDia>(`/reports/resumen-dia?date=${d}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(today); }, []);

  const handleDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
    load(e.target.value);
  };

  const pendienteDia = (data?.totalFacturado ?? 0) - (data?.totalCobrado ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Resumen del Día</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cierre diario — facturación, cobranza y alertas
          </p>
        </div>

        <input
          type="date"
          value={date}
          onChange={handleDate}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A05A]"
        />
      </div>

      {loading && (
        <div className="text-sm text-gray-400 py-4">Cargando…</div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<TrendingUp size={20} className="text-white" />}
              label="Total facturado"
              value={`₲ ${money(data.totalFacturado)}`}
              sub={`${data.cantFacturas} factura(s)`}
              color="bg-[#C5A05A]"
            />
            <KpiCard
              icon={<HandCoins size={20} className="text-white" />}
              label="Total cobrado"
              value={`₲ ${money(data.totalCobrado)}`}
              sub={`${data.cantCobros} cobro(s)`}
              color="bg-emerald-500"
            />
            <KpiCard
              icon={<FileText size={20} className="text-white" />}
              label="Pendiente del día"
              value={`₲ ${money(pendienteDia)}`}
              sub="Facturado menos cobrado"
              color={pendienteDia > 0 ? "bg-amber-500" : "bg-emerald-500"}
              textColor={pendienteDia > 0 ? "text-amber-700" : "text-emerald-700"}
            />
            <KpiCard
              icon={<AlertTriangle size={20} className="text-white" />}
              label="Facturas vencidas"
              value={String(data.facturasVencidas)}
              sub="Al cierre de esta fecha"
              color={data.facturasVencidas > 0 ? "bg-red-500" : "bg-gray-400"}
              textColor={data.facturasVencidas > 0 ? "text-red-700" : "text-gray-600"}
            />
          </div>

          {/* Resumen narrativo */}
          <Card className="p-5 shadow-sm">
            <div className="font-semibold text-gray-900 mb-3">
              Resumen — {new Date(date + "T00:00:00").toLocaleDateString("es-PY", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex justify-between border-b pb-2">
                <span>Facturas emitidas</span>
                <span className="font-semibold">{data.cantFacturas}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Total facturado</span>
                <span className="font-semibold">₲ {money(data.totalFacturado)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Cobros registrados</span>
                <span className="font-semibold">{data.cantCobros}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Total cobrado</span>
                <span className="font-semibold text-emerald-700">₲ {money(data.totalCobrado)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Diferencia (pendiente del día)</span>
                <span className={`font-semibold ${pendienteDia > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  ₲ {money(pendienteDia)}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Facturas vencidas acumuladas</span>
                <span className={`font-bold ${data.facturasVencidas > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {data.facturasVencidas}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
