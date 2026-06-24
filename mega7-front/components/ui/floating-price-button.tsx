"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { PriceSimulatorSheet } from "@/components/ui/price-simulator-sheet";

export function FloatingPriceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Simulador de precios"
        className="
          fixed bottom-6 right-24 z-[1200]
          h-14 w-14 rounded-full
          bg-emerald-500 hover:bg-emerald-600
          text-white
          shadow-xl hover:shadow-2xl
          flex items-center justify-center
          transition
        "
      >
        <Calculator size={22} />
      </button>

      <PriceSimulatorSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
