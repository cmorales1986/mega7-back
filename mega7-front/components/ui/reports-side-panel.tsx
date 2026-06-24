"use client";

import { X, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { useReportMenu } from "@/components/ui/reports/useReportMenu";
import { getLucideIcon } from "@/components/ui/reports/icon-map";
import type { ReportMenuNode } from "@/components/ui/reports/report-menu.types";

export function ReportsSidePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const { data, loading, error } = useReportMenu();

  if (!open) return null;

  const go = (href: string) => {
    router.push(href);
    onClose(); // ✅ cierra el panel al navegar
  };

  // Render helper
  const renderGroup = (group: ReportMenuNode) => {
    const title = group.nombre;
    const items = group.children ?? [];

    return (
      <div key={group.id} className="mb-3">
        <div className="px-2 pt-2 pb-1 text-[11px] font-bold tracking-wider text-gray-500 uppercase">
          {title}
        </div>

        <div className="space-y-1">
          {items.map((it) => {
            const active = !!it.url && pathname === it.url;
            const Icon = getLucideIcon(it.icono);

            return (
              <Button
                key={it.id}
                variant="ghost"
                onClick={() => it.url && go(it.url)}
                disabled={!it.url}
                className={`
                  w-full justify-start rounded-xl h-10
                  ${active ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}
                  ${!it.url ? "opacity-60 cursor-not-allowed" : ""}
                `}
              >
                {/* Dot color opcional */}
                {it.color ? (
                  <span
                    className="mr-2 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: it.color }}
                  />
                ) : null}

                {Icon ? <Icon className="mr-2" size={18} /> : null}

                <span className="flex-1 text-left">{it.nombre}</span>
                <ChevronRight size={16} className="opacity-60" />
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1190]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="
          fixed top-0 right-0 h-full w-[420px]
          bg-white z-[1200]
          shadow-2xl border-l
          animate-slide-in
          flex flex-col
        "
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-white to-gray-50">
          <div>
            <div className="text-xs text-gray-500">Centro</div>
            <h2 className="text-lg font-semibold">Panel de Reportes</h2>
          </div>

          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {/* Intro */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold">Centro de Reportes</div>
            <div className="text-xs text-gray-500">
              Seleccioná un reporte para abrirlo en pantalla completa.
            </div>
          </div>
          {/* Menú */}
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-white to-gray-50">
              <div className="text-sm font-semibold">Reportes</div>
              <div className="text-xs text-gray-500">Navegación rápida</div>
            </div>

            

            <div className="p-2">
              {loading ? (
                <div className="p-3 text-sm text-gray-500">Cargando menú…</div>
              ) : error ? (
                <div className="p-3 text-sm text-red-600">{error}</div>
              ) : data.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  No hay reportes disponibles.
                </div>
              ) : (
                data.map(renderGroup)
              )}
            </div>
          </Card>
        </div>
      </aside>
    </>
  );
}
