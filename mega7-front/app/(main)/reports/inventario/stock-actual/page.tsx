"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Package, AlertTriangle } from "lucide-react";

const fmt = new Intl.NumberFormat("es-PY");
const money = (n: number) => fmt.format(Math.round(n));
const qty   = (n: number) => fmt.format(n);

type StockRow = {
  productId: number;
  productCode: string;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  minimumStock: number;
  avgCost: number;
  totalValue: number;
  belowMin: boolean;
};

type Warehouse = { id: number; name: string };

export default function StockActualPage() {
  const [rows, setRows]           = useState<StockRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState(0);
  const [search, setSearch]       = useState("");
  const [onlyLow, setOnlyLow]     = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get<Warehouse[]>("/warehouses").then((r) => setWarehouses(r.data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = warehouseId > 0 ? `?warehouseId=${warehouseId}` : "";
    api
      .get<StockRow[]>(`/reports/stock-actual${qs}`)
      .then((r) => setRows(r.data ?? []))
      .finally(() => setLoading(false));
  }, [warehouseId]);

  const filtered = rows.filter((r) => {
    const matchSearch = r.productName.toLowerCase().includes(search.toLowerCase())
      || r.productCode.toLowerCase().includes(search.toLowerCase());
    const matchLow = !onlyLow || r.belowMin;
    return matchSearch && matchLow;
  });

  const totalValue  = filtered.reduce((s, r) => s + r.totalValue, 0);
  const countLow    = filtered.filter((r) => r.belowMin).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Stock Actual</h1>
        <p className="text-sm text-gray-500 mt-1">
          Inventario disponible por producto y depósito
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="border rounded-lg px-3 py-2 text-sm bg-white w-56 focus:outline-none focus:ring-2 focus:ring-[#C5A05A]"
        />

        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A05A]"
        >
          <option value={0}>Todos los depósitos</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => setOnlyLow(e.target.checked)}
            className="rounded"
          />
          Solo stock bajo mínimo
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 shadow-sm flex gap-3 items-center">
          <div className="bg-[#C5A05A] rounded-xl p-2.5">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Productos en lista</div>
            <div className="text-xl font-bold">{filtered.length}</div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm flex gap-3 items-center">
          <div className={`rounded-xl p-2.5 ${countLow > 0 ? "bg-red-500" : "bg-emerald-500"}`}>
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Bajo mínimo</div>
            <div className={`text-xl font-bold ${countLow > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {countLow}
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm flex gap-3 items-center">
          <div className="bg-blue-500 rounded-xl p-2.5">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Valor total</div>
            <div className="text-xl font-bold">₲ {money(totalValue)}</div>
          </div>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="shadow-sm overflow-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No hay registros.</div>
        ) : (
          <table className="w-full text-sm min-w-[780px]">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 border-b font-medium text-gray-600">Código</th>
                <th className="px-4 py-3 border-b font-medium text-gray-600">Producto</th>
                <th className="px-4 py-3 border-b font-medium text-gray-600">Depósito</th>
                <th className="px-4 py-3 border-b text-right font-medium text-gray-600">Stock</th>
                <th className="px-4 py-3 border-b text-right font-medium text-gray-600">Mínimo</th>
                <th className="px-4 py-3 border-b text-right font-medium text-gray-600">Costo prom.</th>
                <th className="px-4 py-3 border-b text-right font-medium text-gray-600">Valor total</th>
                <th className="px-4 py-3 border-b font-medium text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={`${r.productId}-${r.warehouseId}`}
                  className={`border-b last:border-0 hover:bg-gray-50 ${r.belowMin ? "bg-red-50" : ""}`}
                >
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.productCode}</td>
                  <td className="px-4 py-2.5 font-medium">{r.productName}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.warehouseName}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{qty(r.quantity)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{qty(r.minimumStock)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₲ {money(r.avgCost)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">₲ {money(r.totalValue)}</td>
                  <td className="px-4 py-2.5">
                    {r.belowMin ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                        Bajo mínimo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
