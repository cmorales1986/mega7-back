"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportMenuNode } from "./report-menu.types";

export function useReportMenu() {
  const [data, setData] = useState<ReportMenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        // tu controller: /api/reportmenu o /api/report-menu según lo hayas nombrado
        // Ajustá esta ruta si tu controller quedó como ReportMenuController => /api/ReportMenu
        const res = await api.get("/reportmenu");
        if (mounted) setData(res.data ?? []);
      } catch (e: any) {
        if (mounted) setError("No se pudo cargar el menú de reportes.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}