// src/features/inventory/stock-transfer/utils.ts
export const fmtPY = new Intl.NumberFormat("es-PY");

export const onlyDigits = (s: string) => (s ?? "").replace(/[^\d]/g, "");

export const splitSerials = (s: string | null | undefined) =>
  (s ?? "")
    .split(/[,;\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export const fmtDatePY = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PY");
};

export const toISODateAtMidnight = (yyyy_mm_dd: string) =>
  new Date(`${yyyy_mm_dd}T00:00:00`).toISOString();
