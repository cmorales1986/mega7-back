"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceSimulator } from "@/features/ui/drawers/PriceSimulator";

export function PriceSimulatorSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Lock scroll del body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[1190] bg-black/35 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal grande centrado (casi full screen) */}
      <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
        <div
          className="
            w-full
            max-w-[95vw] 2xl:max-w-[1400px]
            max-h-[92vh]
            bg-white
            rounded-2xl
            shadow-2xl
            border border-gray-200
            overflow-hidden
            animate-zoom-in
          "
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()} // evita cerrar al click dentro
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-white to-gray-50">
            <div>
              <div className="text-sm text-gray-500">Herramienta</div>
              <div className="text-lg font-semibold">
                Simulador de Precios / Competencia
              </div>
            </div>

            <Button
              variant="ghost"
              className="h-9 w-9 p-0 rounded-full"
              onClick={onClose}
              title="Cerrar"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Body (scroll interno) */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(92vh - 72px)" }}>
            <PriceSimulator />
          </div>
        </div>
      </div>
    </>
  );
}
