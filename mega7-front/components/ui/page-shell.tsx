"use client";

import React from "react";

export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export function PageShell({
  icon,
  title,
  subtitle,
  chips,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  chips?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                {icon}
              </div>
              <h1 className="text-3xl font-semibold">{title}</h1>
            </div>

            {subtitle ? (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}

            {chips ? <div className="mt-3 flex flex-wrap gap-2">{chips}</div> : null}
          </div>

          {right ? <div className="flex flex-wrap gap-2">{right}</div> : null}
        </div>
      </div>

      {children}
    </div>
  );
}
