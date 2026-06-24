"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrawers } from "./useDrawers";

export function RightDrawer({ children }: { children: React.ReactNode }) {
  const { openPanel, close } = useDrawers();
  const isOpen = openPanel === "reports";

  return (
    <div
      className={`
        fixed top-0 right-0 h-screen z-[1200]
        w-[420px] sm:w-[520px] lg:w-[620px]
        transition-transform duration-300 ease-out
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
      role="dialog"
      aria-modal="true"
    >
      <div className="h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-white to-gray-50">
          <div>
            <div className="text-sm text-gray-500">Centro</div>
            <div className="text-lg font-semibold">Panel de Reportes</div>
          </div>

          <Button variant="ghost" className="h-9 w-9 p-0 rounded-full" onMouseDown={(e) => {
  e.preventDefault();
  e.stopPropagation();
  close();
}}title="Cerrar">
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
