"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrawers } from "./useDrawers";

export function BottomDrawer({ children }: { children: React.ReactNode }) {
  const { openPanel, close } = useDrawers();
  const isOpen = openPanel === "price";

  return (
    <div
      className={`
        fixed left-0 right-0 bottom-0 z-[1200]
        transition-transform duration-300 ease-out
        ${isOpen ? "translate-y-0" : "translate-y-full"}
      `}
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="bg-white rounded-t-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-white to-gray-50">
            <div>
              <div className="text-sm text-gray-500">Herramienta</div>
              <div className="text-lg font-semibold">Simulador de Precios / Competencia</div>
            </div>

            <Button variant="ghost" className="h-9 w-9 p-0 rounded-full" onClick={close} title="Cerrar">
              <X size={18} />
            </Button>
          </div>

          {/* Body */}
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
