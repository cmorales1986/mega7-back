"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { reportsDrawerMenu } from "../../../components/ui/reports/reports-drawer-data";
import { useDrawers } from "./useDrawers";

export function ReportsPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { close } = useDrawers();

  const go = (href: string) => {
    router.push(href);
    close(); // ✅ al navegar, cerramos el drawer
  };

  return (
    <div className="space-y-4">
      {/* Bloque “Viewer” arriba (placeholder) */}
      <Card className="p-4 rounded-2xl border shadow-sm">
        <div className="text-sm font-semibold">BoldReports Viewer</div>
        <div className="text-xs text-gray-500">
          Elegí un reporte del menú. Luego, en la page, montamos el Viewer.
        </div>
      </Card>

      <Card className="rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-white to-gray-50">
          <div className="text-sm font-semibold">Reportes</div>
          <div className="text-xs text-gray-500">Navegación rápida</div>
        </div>

        <Separator />

        <div className="p-2">
          {reportsDrawerMenu.map((group) => (
            <div key={group.title} className="mb-3">
              <div className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase">
                {group.title}
              </div>

              <div className="space-y-1">
                {group.items.map((it) => {
                  const active = pathname === it.href;
                  const Icon = it.icon;

                  return (
                    <Button
                      key={it.href}
                      variant="ghost"
                      onClick={() => go(it.href)}
                      className={`
                        w-full justify-start rounded-xl h-10
                        ${active ? "bg-gray-100" : "hover:bg-gray-50"}
                      `}
                    >
                      {Icon ? <Icon className="mr-2" size={18} /> : null}
                      <span className="flex-1 text-left">{it.title}</span>
                      <ChevronRight size={16} className="opacity-60" />
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
