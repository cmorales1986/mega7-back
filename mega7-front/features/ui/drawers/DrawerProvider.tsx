"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type DrawerPanel = "none" | "price" | "reports";

type DrawerCtx = {
  openPanel: DrawerPanel;
  isOpen: boolean;
  open: (panel: Exclude<DrawerPanel, "none">) => void;
  close: () => void;
  toggle: (panel: Exclude<DrawerPanel, "none">) => void;
};

export const DrawerContext = createContext<DrawerCtx | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [openPanel, setOpenPanel] = useState<DrawerPanel>("none");

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOpen = openPanel !== "none";

  const close = useCallback(() => setOpenPanel("none"), []);

  const open = useCallback((panel: Exclude<DrawerPanel, "none">) => {
    setOpenPanel(panel);
  }, []);

  const toggle = useCallback((panel: Exclude<DrawerPanel, "none">) => {
    setOpenPanel((prev) => (prev === panel ? "none" : panel));
  }, []);

  // ✅ Cierra SIEMPRE al cambiar ruta o query (App Router mantiene layouts vivos)
  useEffect(() => {
    if (openPanel !== "none") setOpenPanel("none");
  }, [pathname, searchParams, openPanel]);

  // ✅ ESC para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // ✅ Lock scroll del body cuando hay drawer abierto
  useEffect(() => {
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const value = useMemo(
    () => ({ openPanel, isOpen, open, close, toggle }),
    [openPanel, isOpen, open, close, toggle]
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}
