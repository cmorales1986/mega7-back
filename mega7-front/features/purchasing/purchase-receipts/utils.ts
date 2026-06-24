export const round2 = (n: number) =>
  Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const toIsoOrNull = (yyyyMmDd: string) => {
  if (!yyyyMmDd) return null;
  const d = new Date(yyyyMmDd);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const splitSerials = (raw: string) =>
  (raw ?? "")
    .split(/,|;|\n|\r/)
    .map((x) => x.trim())
    .filter(Boolean);

export const unitNetCost = (unitPrice: number, discountPercent: number) => {
  const disc = clamp(Number(discountPercent || 0), 0, 100);
  return round2(Number(unitPrice || 0) * ((100 - disc) / 100));
};
