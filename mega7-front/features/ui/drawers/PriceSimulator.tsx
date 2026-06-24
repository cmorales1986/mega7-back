"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function num(x: any) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function PriceSimulator() {
  const [product, setProduct] = useState("");
  const [cost, setCost] = useState("");
  const [marginPct, setMarginPct] = useState("25");
  const [competitorPrice, setCompetitorPrice] = useState("");

  const suggested = useMemo(() => {
    const c = num(cost);
    const m = num(marginPct) / 100;
    return c * (1 + m);
  }, [cost, marginPct]);

  const diffPct = useMemo(() => {
    const comp = num(competitorPrice);
    if (comp <= 0) return 0;
    return ((suggested - comp) / comp) * 100;
  }, [suggested, competitorPrice]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 rounded-2xl border shadow-sm">
        <div className="text-sm font-semibold">Datos</div>
        <div className="text-xs text-gray-500">Completá para simular</div>

        <Separator className="my-3" />

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Producto</Label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ej: Aceite 1L" />
          </div>

          <div className="space-y-1">
            <Label>Costo</Label>
            <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" inputMode="decimal" />
          </div>

          <div className="space-y-1">
            <Label>Margen (%)</Label>
            <Input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="25" inputMode="decimal" />
          </div>

          <div className="space-y-1">
            <Label>Precio Competidor</Label>
            <Input
              value={competitorPrice}
              onChange={(e) => setCompetitorPrice(e.target.value)}
              placeholder="0"
              inputMode="decimal"
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border shadow-sm lg:col-span-2">
        <div className="text-sm font-semibold">Resultado</div>
        <div className="text-xs text-gray-500">Comparación vs competencia</div>

        <Separator className="my-3" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Metric title="Precio sugerido" value={suggested} suffix="" />
          <Metric title="Precio competidor" value={num(competitorPrice)} suffix="" />
          <Metric title="Diferencia %" value={diffPct} suffix="%" />
        </div>

        <div className="mt-4 text-xs text-gray-600">
          * Placeholder: después lo conectamos a productos reales, listas de precios, reglas por cliente, etc.
        </div>
      </Card>
    </div>
  );
}

function Metric({ title, value, suffix }: { title: string; value: number; suffix: string }) {
  const formatted = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  const isNeg = value < 0;

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`mt-1 text-2xl font-semibold ${isNeg ? "text-red-600" : "text-gray-900"}`}>
        {formatted}
        {suffix ? <span className="text-base ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}
