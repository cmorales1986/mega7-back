"use client";

import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportExportBarProps {
  onExcel: () => void;
  disabled?: boolean;
}

export function ReportExportBar({ onExcel, disabled }: ReportExportBarProps) {
  return (
    <div className="flex gap-2 no-print">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => window.print()}
        className="bg-white"
      >
        <Printer className="mr-2 h-4 w-4" />
        Imprimir / PDF
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onExcel}
        className="bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
      >
        <Download className="mr-2 h-4 w-4" />
        Exportar Excel
      </Button>
    </div>
  );
}
