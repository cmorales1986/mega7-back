"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { ReportsSidePanel } from "./reports-side-panel";

export function FloatingReportsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="
          fixed bottom-6 right-6 z-[1200]
          h-14 w-14 rounded-full
          bg-[#2563eb] hover:bg-[#1d4ed8]
          text-white shadow-xl
          flex items-center justify-center
          transition
        "
        title="Abrir reportes"
      >
        <BarChart3 size={22} />
      </button>

      <ReportsSidePanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
