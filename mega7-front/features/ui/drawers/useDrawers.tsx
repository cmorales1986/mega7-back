"use client";

import { useContext } from "react";
import { DrawerContext } from "./DrawerProvider";

export function useDrawers() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawers debe usarse dentro de <DrawerProvider />");
  return ctx;
}
