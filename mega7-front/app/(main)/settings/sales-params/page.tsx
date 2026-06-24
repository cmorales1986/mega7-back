"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCcw,
  Save,
  Trash2,
  Calculator,
  Coins,
  Settings2,
  Users,
  BadgePercent,
} from "lucide-react";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);

// =====================
// Types
// =====================
type SocioNegocio = {
  id: number;
  code?: string;
  razonSocial?: string;
  partnerType?: string;
};

// ✅ DTO que viene del backend (GET)
type SalesPricingParamsDto = {
  customerId?: number | null;

  cashMarkupPct: number;
  creditDefaultMarkupPct: number;
  installmentDefaultMarkupPct: number;

  // ✅ mora cuotas (monto fijo + gracia + tope monto)
  lateFeeAmountPerDay: number;
  lateFeeGraceDays: number;
  lateFeeCapAmount: number;
};

// ✅ DTO que enviamos al backend (POST)
type SalesPricingParamsUpsertDto = {
  cashMarkupPct: number;
  creditDefaultMarkupPct: number;
  installmentDefaultMarkupPct: number;

  lateFeeAmountPerDay: number;
  lateFeeGraceDays: number;
  lateFeeCapAmount: number;
};

type CreditTermMarkupRowDto = {
  creditTermId: number;
  creditTermName: string;
  days: number;

  globalMarkupPct: number | null;
  customerMarkupPct: number | null;
  effectiveMarkupPct: number;
};

type PaymentType = "Cash" | "Credit" | "Installments";

type PriceCalcRequest = {
  cost: number;
  customerId?: number | null;
  paymentType: number; // 1 cash, 2 credit, 3 installments
  creditTermId?: number | null;
  installmentsCount?: number | null;
  installmentIntervalDays?: number | null;
  dueDate?: string | null;
  paymentDate?: string | null;
};

type PriceCalcResult = {
  baseCost: number;
  markupPctApplied: number;
  markupAmount: number;
  priceSuggested: number;
  daysLate: number;
  chargedLateDays: number; // ✅ nuevo
  lateFeeAmount: number;
  total: number;
  ruleInfo?: string | null;
};

// =====================
// Helpers
// =====================
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// Para ints (gracia)
const i = (v: any) => {
  const x = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(x) ? x : 0;
};

function Chip({
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

function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border bg-white p-2 shadow-sm">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {right ? <div className="flex gap-2">{right}</div> : null}
    </div>
  );
}

const emptyParams = (): SalesPricingParamsUpsertDto => ({
  cashMarkupPct: 0,
  creditDefaultMarkupPct: 0,
  installmentDefaultMarkupPct: 0,

  lateFeeAmountPerDay: 0,
  lateFeeGraceDays: 0,
  lateFeeCapAmount: 0,
});

export default function SalesParamsPage() {
  const [loading, setLoading] = useState(false);

  // Global params (UPsert DTO)
  const [globalParams, setGlobalParams] = useState<SalesPricingParamsUpsertDto>(
    emptyParams()
  );

  // Global credit grid
  const [globalCreditRows, setGlobalCreditRows] = useState<
    CreditTermMarkupRowDto[]
  >([]);

  // Customers
  const [customers, setCustomers] = useState<SocioNegocio[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);

  // Customer params + grid
  const [custParams, setCustParams] = useState<SalesPricingParamsUpsertDto>(
    emptyParams()
  );
  const [custParamsExists, setCustParamsExists] = useState(false);
  const [custCreditRows, setCustCreditRows] = useState<
    CreditTermMarkupRowDto[]
  >([]);

  // Simulator
  const [sim, setSim] = useState<{
    cost: string;
    paymentType: PaymentType;
    creditTermId: number | null;
    installmentsCount: string;
    installmentIntervalDays: string;
    dueDate: string;
    paymentDate: string;
  }>({
    cost: "",
    paymentType: "Cash",
    creditTermId: null,
    installmentsCount: "",
    installmentIntervalDays: "",
    dueDate: "",
    paymentDate: "",
  });

  const [simResult, setSimResult] = useState<PriceCalcResult | null>(null);

  // =====================
  // Loaders
  // =====================
  const loadCustomers = async () => {
    const res = await api.get<SocioNegocio[]>("/sociosnegocio/clientes");
    setCustomers(res.data ?? []);
  };

  const mapToUpsert = (
    p: SalesPricingParamsDto | null
  ): SalesPricingParamsUpsertDto => {
    return {
      cashMarkupPct: n(p?.cashMarkupPct),
      creditDefaultMarkupPct: n(p?.creditDefaultMarkupPct),
      installmentDefaultMarkupPct: n(p?.installmentDefaultMarkupPct),

      lateFeeAmountPerDay: n(p?.lateFeeAmountPerDay),
      lateFeeGraceDays: i(p?.lateFeeGraceDays),
      lateFeeCapAmount: n(p?.lateFeeCapAmount),
    };
  };

  const loadGlobal = async () => {
    const res = await api.get<SalesPricingParamsDto | null>(
      "/salespricing/params/global"
    );
    setGlobalParams(mapToUpsert(res.data ?? null));
  };

  const loadGlobalCreditGrid = async () => {
    const res = await api.get<CreditTermMarkupRowDto[]>(
      "/salespricing/credit-term-markups"
    );
    setGlobalCreditRows(res.data ?? []);
  };

  const loadCustomerStuff = async (id: number) => {
    const pRes = await api.get<SalesPricingParamsDto | null>(
      `/salespricing/params/customer/${id}`
    );
    const p = pRes.data;

    if (p) {
      setCustParamsExists(true);
      setCustParams(mapToUpsert(p));
    } else {
      setCustParamsExists(false);
      setCustParams({ ...globalParams });
    }

    const gRes = await api.get<CreditTermMarkupRowDto[]>(
      `/salespricing/credit-term-markups?customerId=${id}`
    );
    setCustCreditRows(gRes.data ?? []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCustomers(),
        loadGlobal(),
        loadGlobalCreditGrid(),
      ]);
      if (customerId) await loadCustomerStuff(customerId);
      Swal.fire("OK", "Datos refrescados", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo refrescar", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadCustomers(),
          loadGlobal(),
          loadGlobalCreditGrid(),
        ]);
      } catch (e: any) {
        Swal.fire("Error", e?.message ?? "No se pudo cargar", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================
  // Save handlers
  // =====================
  const saveGlobalParams = async () => {
    setLoading(true);
    try {
      await api.post("/salespricing/params/global", globalParams);
      Swal.fire("OK", "Parámetros globales guardados", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo guardar", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveCustomerParams = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      await api.post(`/salespricing/params/customer/${customerId}`, custParams);
      setCustParamsExists(true);
      Swal.fire("OK", "Override por cliente guardado", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo guardar", "error");
    } finally {
      setLoading(false);
    }
  };

  const clearCustomerParams = async () => {
    if (!customerId) return;
    const ok = await Swal.fire({
      title: "Quitar override del cliente?",
      text: "Se desactiva el registro del cliente (soft delete).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    setLoading(true);
    try {
      await api.delete(`/salespricing/params/customer/${customerId}`);
      setCustParamsExists(false);
      setCustParams({ ...globalParams });
      Swal.fire("OK", "Override removido", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo eliminar", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveGlobalCreditBulk = async () => {
    setLoading(true);
    try {
      const payload = globalCreditRows.map((r) => ({
        creditTermId: r.creditTermId,
        markupPct: n(r.globalMarkupPct ?? 0),
        isActive: true,
      }));
      await api.put("/salespricing/credit-term-markups/bulk", payload);
      await loadGlobalCreditGrid();
      Swal.fire("OK", "Reglas globales por término guardadas", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo guardar", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveCustomerCreditBulk = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const payload = custCreditRows.map((r) => ({
        creditTermId: r.creditTermId,
        markupPct: n(r.customerMarkupPct ?? 0),
        isActive: true,
      }));
      await api.put(
        `/salespricing/credit-term-markups/bulk?customerId=${customerId}`,
        payload
      );
      await loadCustomerStuff(customerId);
      Swal.fire("OK", "Reglas por cliente guardadas", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo guardar", "error");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // Simulator
  // =====================
  const runSimulator = async () => {
    setLoading(true);
    try {
      const req: PriceCalcRequest = {
        cost: n(sim.cost),
        customerId: customerId,
        paymentType:
          sim.paymentType === "Cash" ? 1 : sim.paymentType === "Credit" ? 2 : 3,
        creditTermId: sim.paymentType === "Credit" ? sim.creditTermId : null,
        installmentsCount:
          sim.paymentType === "Installments" ? n(sim.installmentsCount) : null,
        installmentIntervalDays:
          sim.paymentType === "Installments"
            ? n(sim.installmentIntervalDays || 0) || null
            : null,
        dueDate: sim.dueDate ? new Date(sim.dueDate).toISOString() : null,
        paymentDate: sim.paymentDate
          ? new Date(sim.paymentDate).toISOString()
          : null,
      };

      const res = await api.post<PriceCalcResult>(
        "/salespricing/calculate",
        req
      );
      setSimResult(res.data);
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo calcular", "error");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // DataGrid columns
  // =====================
  const globalCreditCols: GridColDef<CreditTermMarkupRowDto>[] = [
    { field: "days", headerName: "Días", width: 90 },
    { field: "creditTermName", headerName: "Término", flex: 1, minWidth: 180 },
    {
      field: "globalMarkupPct",
      headerName: "% Global",
      width: 140,
      editable: true,
    },
    { field: "effectiveMarkupPct", headerName: "% Efectivo", width: 140 },
  ];

  const custCreditCols: GridColDef<CreditTermMarkupRowDto>[] = [
    { field: "days", headerName: "Días", width: 90 },
    { field: "creditTermName", headerName: "Término", flex: 1, minWidth: 180 },
    { field: "globalMarkupPct", headerName: "% Global", width: 120 },
    {
      field: "customerMarkupPct",
      headerName: "% Cliente",
      width: 140,
      editable: true,
    },
    { field: "effectiveMarkupPct", headerName: "% Efectivo", width: 140 },
  ];

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* PAGE HEADER */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <Coins className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Parámetros de Venta</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Configuración global y overrides por cliente para precios, crédito
              y mora.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">
                <Settings2 className="h-3.5 w-3.5" />
                Configuración
              </Chip>
              <Chip
                tone={
                  customerId ? (custParamsExists ? "ok" : "warn") : "neutral"
                }
              >
                <Users className="h-3.5 w-3.5" />
                Override:{" "}
                {customerId ? (custParamsExists ? "Activo" : "No") : "N/A"}
              </Chip>
              <Chip tone="warn">Mora: solo Cuotas</Chip>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={loading}
            className="bg-white"
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
        </div>
      </div>

      {/* SELECTOR CLIENTE */}
      <Card className="border-slate-200 p-0 shadow-sm">
        <div className="rounded-t-xl border-b bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-slate-700" />
            Cliente (opcional)
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Seleccioná un cliente si querés definir overrides específicos.
          </p>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            <div className="md:col-span-2">
              <Label>Cliente</Label>
              <Select
                value={customerId ? String(customerId) : ""}
                onValueChange={async (v) => {
                  const id = v ? Number(v) : null;
                  setCustomerId(id);
                  setSimResult(null);
                  if (id) await loadCustomerStuff(id);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona un cliente para overrides..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {(c.code ? `${c.code} - ` : "") +
                        (c.razonSocial ?? `Cliente ${c.id}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Estado</Label>
              <div className="flex items-center gap-2">
                <Chip
                  tone={
                    customerId ? (custParamsExists ? "ok" : "warn") : "neutral"
                  }
                >
                  Override:{" "}
                  {customerId ? (custParamsExists ? "Sí" : "No") : "—"}
                </Chip>
                {selectedCustomer?.code ? (
                  <Chip tone="neutral">{selectedCustomer.code}</Chip>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* TABS */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="w-full justify-start gap-1 rounded-xl border bg-white p-1 shadow-sm">
          <TabsTrigger
            value="global"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Global
          </TabsTrigger>

          <TabsTrigger
            value="cliente"
            disabled={!customerId}
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Por Cliente
          </TabsTrigger>

          <TabsTrigger
            value="simulador"
            className="rounded-lg px-4 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow"
          >
            Simulador
          </TabsTrigger>
        </TabsList>

        {/* ===================== GLOBAL ===================== */}
        <TabsContent value="global" className="space-y-6 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<BadgePercent className="h-5 w-5 text-purple-600" />}
              title="Parámetros Globales"
              subtitle="Defaults del sistema (se aplican si el cliente no tiene override)."
              right={
                <Button
                  onClick={saveGlobalParams}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" /> Guardar Global
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div>
                <Label>% Contado</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={globalParams.cashMarkupPct}
                  onChange={(e) =>
                    setGlobalParams((s) => ({
                      ...s,
                      cashMarkupPct: n(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label>% Default Crédito</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={globalParams.creditDefaultMarkupPct}
                  onChange={(e) =>
                    setGlobalParams((s) => ({
                      ...s,
                      creditDefaultMarkupPct: n(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label>% Default Cuotas</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={globalParams.installmentDefaultMarkupPct}
                  onChange={(e) =>
                    setGlobalParams((s) => ({
                      ...s,
                      installmentDefaultMarkupPct: n(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label>Mora por día (Gs)</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={globalParams.lateFeeAmountPerDay}
                  onChange={(e) =>
                    setGlobalParams((s) => ({
                      ...s,
                      lateFeeAmountPerDay: n(e.target.value),
                    }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Aplica solo a cuotas.
                </p>
              </div>

              <div>
                <Label>Días de gracia</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={globalParams.lateFeeGraceDays}
                  onChange={(e) =>
                    setGlobalParams((s) => ({
                      ...s,
                      lateFeeGraceDays: Math.max(0, i(e.target.value)),
                    }))
                  }
                />
              </div>

              <div>
                <Label>Tope mora (Gs)</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={globalParams.lateFeeCapAmount}
                  onChange={(e) =>
                    setGlobalParams((s) => ({
                      ...s,
                      lateFeeCapAmount: Math.max(0, n(e.target.value)),
                    }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  0 = sin tope.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Settings2 className="h-5 w-5 text-purple-600" />}
              title="Crédito por Términos (Global)"
              subtitle="Por cada CreditTerm (días), definí el recargo % sobre costo."
              right={
                <Button
                  onClick={saveGlobalCreditBulk}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" /> Guardar Tramos Global
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 430, width: "100%" }}>
                  <DataGrid
                    rows={globalCreditRows}
                    getRowId={(r: CreditTermMarkupRowDto): GridRowId =>
                      r.creditTermId
                    }
                    columns={globalCreditCols}
                    pageSizeOptions={[10, 20, 50]}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 20, page: 0 },
                      },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                    processRowUpdate={(newRow) => {
                      setGlobalCreditRows((prev) =>
                        prev.map((r) =>
                          r.creditTermId === newRow.creditTermId
                            ? {
                                ...r,
                                globalMarkupPct: n(newRow.globalMarkupPct),
                                effectiveMarkupPct: n(newRow.globalMarkupPct),
                              }
                            : r
                        )
                      );
                      return newRow;
                    }}
                    onProcessRowUpdateError={(err) => {
                      console.error(err);
                      Swal.fire("Error", "No se pudo editar la fila", "error");
                    }}
                  />
                </div>
              </ThemeProvider>
            </div>
          </Card>
        </TabsContent>

        {/* ===================== CLIENTE ===================== */}
        <TabsContent value="cliente" className="space-y-6 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Users className="h-5 w-5 text-purple-600" />}
              title="Override por Cliente"
              subtitle="Estos valores reemplazan los globales para el cliente seleccionado."
              right={
                <>
                  <Button
                    onClick={saveCustomerParams}
                    disabled={loading || !customerId}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Save className="mr-2 h-4 w-4" /> Guardar Override
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={clearCustomerParams}
                    disabled={loading || !customerId || !custParamsExists}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Quitar
                  </Button>
                </>
              }
            />

            <Separator className="my-4" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div>
                <Label>% Contado</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={custParams.cashMarkupPct}
                  onChange={(e) =>
                    setCustParams((s) => ({
                      ...s,
                      cashMarkupPct: n(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label>% Default Crédito</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={custParams.creditDefaultMarkupPct}
                  onChange={(e) =>
                    setCustParams((s) => ({
                      ...s,
                      creditDefaultMarkupPct: n(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label>% Default Cuotas</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={custParams.installmentDefaultMarkupPct}
                  onChange={(e) =>
                    setCustParams((s) => ({
                      ...s,
                      installmentDefaultMarkupPct: n(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label>Mora por día (Gs)</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={custParams.lateFeeAmountPerDay}
                  onChange={(e) =>
                    setCustParams((s) => ({
                      ...s,
                      lateFeeAmountPerDay: n(e.target.value),
                    }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Aplica solo a cuotas.
                </p>
              </div>

              <div>
                <Label>Días de gracia</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={custParams.lateFeeGraceDays}
                  onChange={(e) =>
                    setCustParams((s) => ({
                      ...s,
                      lateFeeGraceDays: Math.max(0, i(e.target.value)),
                    }))
                  }
                />
              </div>

              <div>
                <Label>Tope mora (Gs)</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={custParams.lateFeeCapAmount}
                  onChange={(e) =>
                    setCustParams((s) => ({
                      ...s,
                      lateFeeCapAmount: Math.max(0, n(e.target.value)),
                    }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  0 = sin tope.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Settings2 className="h-5 w-5 text-purple-600" />}
              title="Crédito por Términos (Cliente)"
              subtitle="Definí recargos por término que sobreescriben el global."
              right={
                <Button
                  onClick={saveCustomerCreditBulk}
                  disabled={loading || !customerId}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" /> Guardar Tramos Cliente
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="rounded-xl border bg-white p-2">
              <ThemeProvider theme={muiTheme}>
                <div style={{ height: 430, width: "100%" }}>
                  <DataGrid
                    rows={custCreditRows}
                    getRowId={(r: CreditTermMarkupRowDto): GridRowId =>
                      r.creditTermId
                    }
                    columns={custCreditCols}
                    pageSizeOptions={[10, 20, 50]}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 20, page: 0 },
                      },
                    }}
                    slots={{ toolbar: GridToolbar }}
                    disableRowSelectionOnClick
                    processRowUpdate={(newRow) => {
                      setCustCreditRows((prev) =>
                        prev.map((r) =>
                          r.creditTermId === newRow.creditTermId
                            ? {
                                ...r,
                                customerMarkupPct: n(newRow.customerMarkupPct),
                                effectiveMarkupPct:
                                  newRow.customerMarkupPct != null
                                    ? n(newRow.customerMarkupPct)
                                    : r.globalMarkupPct ?? 0,
                              }
                            : r
                        )
                      );
                      return newRow;
                    }}
                    onProcessRowUpdateError={(err) => {
                      console.error(err);
                      Swal.fire("Error", "No se pudo editar la fila", "error");
                    }}
                  />
                </div>
              </ThemeProvider>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Tip: si querés que “vacío = usar global”, hacemos endpoint para
              borrar por término.
            </p>
          </Card>
        </TabsContent>

        {/* ===================== SIMULADOR ===================== */}
        <TabsContent value="simulador" className="space-y-6 pt-4">
          <Card className="border-slate-200 p-6 shadow-sm">
            <SectionHeader
              icon={<Calculator className="h-5 w-5 text-purple-600" />}
              title="Simulador"
              subtitle="Probá el cálculo de precio/recargo/mora antes de aplicarlo."
              right={
                <Button
                  onClick={runSimulator}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Calculator className="mr-2 h-4 w-4" /> Calcular
                </Button>
              }
            />

            <Separator className="my-4" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Costo</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={sim.cost}
                  onChange={(e) =>
                    setSim((s) => ({ ...s, cost: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Tipo de Pago</Label>
                <Select
                  value={sim.paymentType}
                  onValueChange={(v: any) => {
                    setSim((s) => ({
                      ...s,
                      paymentType: v,
                      creditTermId: null,
                    }));
                    setSimResult(null);
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Cash">Contado</SelectItem>
                    <SelectItem value="Credit">Crédito</SelectItem>
                    <SelectItem value="Installments">Cuotas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sim.paymentType === "Credit" && (
                <div>
                  <Label>Credit Term</Label>
                  <Select
                    value={sim.creditTermId ? String(sim.creditTermId) : ""}
                    onValueChange={(v) =>
                      setSim((s) => ({
                        ...s,
                        creditTermId: v ? Number(v) : null,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona término..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {(customerId ? custCreditRows : globalCreditRows).map(
                        (r) => (
                          <SelectItem
                            key={r.creditTermId}
                            value={String(r.creditTermId)}
                          >
                            {r.days} días - {r.creditTermName}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {sim.paymentType === "Installments" && (
                <>
                  <div>
                    <Label>Cant. Cuotas</Label>
                    <Input
                      className="bg-white"
                      type="number"
                      value={sim.installmentsCount}
                      onChange={(e) =>
                        setSim((s) => ({
                          ...s,
                          installmentsCount: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Intervalo (días) (opcional)</Label>
                    <Input
                      className="bg-white"
                      type="number"
                      value={sim.installmentIntervalDays}
                      onChange={(e) =>
                        setSim((s) => ({
                          ...s,
                          installmentIntervalDays: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Vencimiento (para mora)</Label>
                <Input
                  className="bg-white"
                  type="date"
                  value={sim.dueDate}
                  onChange={(e) =>
                    setSim((s) => ({ ...s, dueDate: e.target.value }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Mora solo aplica si Tipo de Pago = Cuotas.
                </p>
              </div>

              <div>
                <Label>Fecha de pago (para mora)</Label>
                <Input
                  className="bg-white"
                  type="date"
                  value={sim.paymentDate}
                  onChange={(e) =>
                    setSim((s) => ({ ...s, paymentDate: e.target.value }))
                  }
                />
              </div>
            </div>

            {simResult && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
                  <Card className="border-slate-200 p-4 shadow-sm">
                    <div className="text-muted-foreground">Recargo %</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {simResult.markupPctApplied}%
                    </div>
                  </Card>

                  <Card className="border-slate-200 p-4 shadow-sm">
                    <div className="text-muted-foreground">Precio sugerido</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Math.round(simResult.priceSuggested).toLocaleString(
                        "es-PY"
                      )}
                    </div>
                  </Card>

                  <Card className="border-slate-200 p-4 shadow-sm">
                    <div className="text-muted-foreground">Mora</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Math.round(simResult.lateFeeAmount).toLocaleString(
                        "es-PY"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Atraso: {simResult.daysLate} días
                      {simResult.chargedLateDays !== simResult.daysLate ? (
                        <> • Mora aplicada: {simResult.chargedLateDays} días</>
                      ) : null}
                    </div>
                  </Card>

                  <Card className="border-slate-200 p-4 shadow-sm">
                    <div className="text-muted-foreground">Total</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Math.round(simResult.total).toLocaleString("es-PY")}
                    </div>
                  </Card>
                </div>

                {simResult.ruleInfo && (
                  <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-700">
                    <span className="font-semibold">Detalle:</span>{" "}
                    <span className="break-words">{simResult.ruleInfo}</span>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
