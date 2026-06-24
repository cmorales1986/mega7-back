"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  RefreshCcw,
  ArrowLeft,
  Wallet,
  Users,
  CalendarDays,
  Eye,
} from "lucide-react";

// MUI DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridRenderCellParams, GridRowId } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";

const muiTheme = createTheme({}, esES);
const fmtPY = new Intl.NumberFormat("es-PY");

// =====================
// UI helpers (MISMO ESTILO que tu page.tsx base)
// =====================
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
      {right ? <div className="flex flex-wrap gap-2">{right}</div> : null}
    </div>
  );
}

// =====================
// Types (según CuoteroController)
// =====================
type CuoteroSummaryItem = {
  customerId: number;
  customerName: string;

  invoicesCount: number;

  installmentsTotal: number;
  installmentsPaid: number;
  installmentsOverdue: number;
  installmentsOpen: number;

  totalAmount: number;
  paidAmount: number;
  balanceTotal: number;
  overdueBalance: number;
};

type CuoteroSummaryResponse = {
  from: string;
  to: string;
  items: CuoteroSummaryItem[];
};

type MatrixCell = {
  status: "PAID" | "OVERDUE" | "OPEN";
  colorHint: "PAID" | "OVERDUE" | "OPEN";
  display: string;

  installmentId: number;
  number: number;
  dueDate: string;

  amount: number;
  paidAmount: number;
  balance: number;

  isPaid: boolean;
  daysOverdue: number;
};

type MatrixRow = {
  rowKey: string;
  arInvoiceId: number;
  docNumber?: string | null;
  invoiceDate: string;
  dueDate?: string | null;

  total: number;
  paidAmount: number;
  balance: number;
  status: string;

  cells: Record<string, MatrixCell | null>; // yyyy-MM
};

type CuoteroMatrixResponse = {
  customerId: number;
  from: string;
  to: string;
  columns: string[]; // yyyy-MM
  rows: MatrixRow[];
};

// SalesInvoice detail mínimo (si tu endpoint trae lines)
type SalesInvoiceLine = {
  id: number;
  productCode?: string | null;
  productName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type SalesInvoiceDetail = {
  id: number;
  docNumber?: string | null;
  customerName: string;
  invoiceDate: string;
  total: number;
  paidAmount: number;
  balance: number;
  lines?: SalesInvoiceLine[];
  installments?: any[];
};

// =====================
// Helpers
// =====================
const toISODateOnly = (d: Date) => d.toISOString().slice(0, 10);

function formatMonth(yyyyMm: string) {
  // 2025-07 => jul-25
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d
    .toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
    .replace(".", "");
}

function money(n: number) {
  return fmtPY.format(Number(n || 0));
}

function cellTone(status?: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "OVERDUE") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

// =====================
// Page
// =====================
export default function CuoteroClientesPage() {
  const [loading, setLoading] = useState(false);

  // vista
  const [view, setView] = useState<"summary" | "matrix">("summary");

  // rango default: mes actual a +8 meses (como controller)
  const now = new Date();
  const [from, setFrom] = useState<string>(toISODateOnly(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState<string>(toISODateOnly(new Date(now.getFullYear(), now.getMonth() + 8, 0)));

  // data
  const [summary, setSummary] = useState<CuoteroSummaryItem[]>([]);
  const [summaryRange, setSummaryRange] = useState<{ from: string; to: string } | null>(null);

  const [matrix, setMatrix] = useState<CuoteroMatrixResponse | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string } | null>(null);

  // dialog factura
  const [openInvoice, setOpenInvoice] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<SalesInvoiceDetail | null>(null);

  // =====================
  // Loaders
  // =====================
  const loadSummary = async () => {
    setLoading(true);
    try {
      const r = await api.get<CuoteroSummaryResponse>(`/cuotero/summary?from=${from}&to=${to}`);
      setSummary(Array.isArray(r.data?.items) ? r.data.items : []);
      setSummaryRange({ from: r.data.from, to: r.data.to });
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message ?? "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMatrix = async (customerId: number, customerName: string) => {
    setLoading(true);
    try {
      const r = await api.get<CuoteroMatrixResponse>(
        `/cuotero/matrix?customerId=${customerId}&from=${from}&to=${to}`
      );
      setMatrix(r.data);
      setSelectedCustomer({ id: customerId, name: customerName });
      setView("matrix");
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message ?? "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  const openInvoiceDetail = async (arInvoiceId: number) => {
    setLoading(true);
    try {
      const r = await api.get<SalesInvoiceDetail>(`/salesinvoices/${arInvoiceId}`);
      setInvoiceDetail(r.data);
      setOpenInvoice(true);
    } catch (e: any) {
      Swal.fire("Error", e?.response?.data ?? e?.message ?? "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      if (view === "summary") {
        await loadSummary();
      } else if (view === "matrix" && selectedCustomer) {
        await loadMatrix(selectedCustomer.id, selectedCustomer.name);
      }
      Swal.fire("OK", "Datos refrescados", "success");
    } catch (e: any) {
      Swal.fire("Error", e?.message ?? "No se pudo refrescar", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================
  // Computed chips/kpis
  // =====================
  const customersCount = useMemo(() => summary.length, [summary]);

  const totalsSummary = useMemo(() => {
    const t = {
      installmentsTotal: 0,
      installmentsPaid: 0,
      installmentsOverdue: 0,
      installmentsOpen: 0,
      overdueBalance: 0,
      balanceTotal: 0,
    };
    for (const r of summary) {
      t.installmentsTotal += Number(r.installmentsTotal || 0);
      t.installmentsPaid += Number(r.installmentsPaid || 0);
      t.installmentsOverdue += Number(r.installmentsOverdue || 0);
      t.installmentsOpen += Number(r.installmentsOpen || 0);
      t.overdueBalance += Number(r.overdueBalance || 0);
      t.balanceTotal += Number(r.balanceTotal || 0);
    }
    return t;
  }, [summary]);

  const matrixTotals = useMemo(() => {
    if (!matrix) return { paidAmount: 0, overdueBalance: 0, openBalance: 0, cells: 0 };

    let paidAmount = 0;
    let overdueBalance = 0;
    let openBalance = 0;
    let cells = 0;

    for (const r of matrix.rows) {
      for (const col of matrix.columns) {
        const c = r.cells?.[col];
        if (!c) continue;
        cells++;

        if (c.status === "PAID") paidAmount += Number(c.amount || 0);
        else if (c.status === "OVERDUE") overdueBalance += Number(c.balance || 0);
        else openBalance += Number(c.balance || 0);
      }
    }

    return { paidAmount, overdueBalance, openBalance, cells };
  }, [matrix]);

  // =====================
  // DataGrid columns (TIPADAS)
  // =====================
  const summaryCols: GridColDef<CuoteroSummaryItem>[] = [
    { field: "customerName", headerName: "Cliente", flex: 1, minWidth: 260 },
    { field: "invoicesCount", headerName: "Fact.", width: 90, align: "center", headerAlign: "center" },
    { field: "installmentsTotal", headerName: "Cuotas", width: 95, align: "center", headerAlign: "center" },
    { field: "installmentsPaid", headerName: "PDO", width: 95, align: "center", headerAlign: "center" },
    { field: "installmentsOverdue", headerName: "Venc.", width: 95, align: "center", headerAlign: "center" },
    { field: "installmentsOpen", headerName: "Pend.", width: 95, align: "center", headerAlign: "center" },
    {
      field: "overdueBalance",
      headerName: "Saldo Venc.",
      width: 150,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => money(Number(row?.overdueBalance ?? 0)),
    },
    {
      field: "balanceTotal",
      headerName: "Saldo Total",
      width: 150,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => money(Number(row?.balanceTotal ?? 0)),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (p: GridRenderCellParams<CuoteroSummaryItem>) => {
        const row = p.row;
        return (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 bg-white"
            title="Ver calendario"
            onClick={(e) => {
              e.stopPropagation();
              loadMatrix(row.customerId, row.customerName);
            }}
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  const matrixCols: GridColDef<MatrixRow>[] = useMemo(() => {
    if (!matrix) return [];

    const base: GridColDef<MatrixRow>[] = [
      {
        field: "docNumber",
        headerName: "Factura",
        width: 140,
        valueGetter: (_v, row) => row?.docNumber ?? `#${row?.arInvoiceId}`,
      },
      {
        field: "total",
        headerName: "Total",
        width: 120,
        align: "right",
        headerAlign: "right",
        valueGetter: (_v, row) => money(Number(row?.total ?? 0)),
      },
      {
        field: "balance",
        headerName: "Saldo",
        width: 120,
        align: "right",
        headerAlign: "right",
        valueGetter: (_v, row) => money(Number(row?.balance ?? 0)),
      },
      {
        field: "view",
        headerName: "",
        width: 70,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        headerAlign: "center",
        align: "center",
        renderCell: (p: GridRenderCellParams<MatrixRow>) => {
          const row = p.row;
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-white"
              title="Ver factura"
              onClick={(e) => {
                e.stopPropagation();
                openInvoiceDetail(row.arInvoiceId);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          );
        },
      },
    ];

    const monthCols: GridColDef<MatrixRow>[] = matrix.columns.map((m) => ({
      field: m,
      headerName: formatMonth(m),
      width: 130,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      valueGetter: (_v, row) => row?.cells?.[m]?.display ?? "",
      renderCell: (p: GridRenderCellParams<MatrixRow>) => {
        const row = p.row;
        const cell = row?.cells?.[m] ?? null;

        if (!cell) return <span className="text-slate-300">—</span>;

        const cls = cellTone(cell.status);
        const title =
          cell.status === "PAID"
            ? "Pagado (PDO)"
            : cell.status === "OVERDUE"
            ? `Atrasado ${cell.daysOverdue} días`
            : "Pendiente";

        return (
          <button
            className={`w-full h-full inline-flex items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}
            title={title}
            onClick={(e) => {
              e.stopPropagation();
              openInvoiceDetail(row.arInvoiceId);
            }}
          >
            {cell.display}
          </button>
        );
      },
    }));

    return [...base, ...monthCols];
  }, [matrix]);

  // =====================
  // Render
  // =====================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* PAGE HEADER (mismo estilo premium) */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Cuotero de Clientes</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Vista resumen por cliente y calendario tipo Excel por factura (PDO / pendiente / atrasado).
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">
                <Users className="h-3.5 w-3.5" />
                Clientes con cuotas: {customersCount}
              </Chip>

              <Chip tone="neutral">
                Cuotas: {totalsSummary.installmentsTotal} | PDO: {totalsSummary.installmentsPaid}
              </Chip>

              <Chip tone={totalsSummary.installmentsOverdue > 0 ? "warn" : "neutral"}>
                Vencidas: {totalsSummary.installmentsOverdue} | Saldo vencido: {money(totalsSummary.overdueBalance)}
              </Chip>

              <Chip tone="neutral">
                Saldo total: {money(totalsSummary.balanceTotal)}
              </Chip>

              {view === "matrix" && selectedCustomer ? (
                <Chip tone="ok">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {selectedCustomer.name}
                </Chip>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            {view === "matrix" ? (
              <Button
                variant="outline"
                className="bg-white"
                onClick={() => {
                  setView("summary");
                  setMatrix(null);
                  setSelectedCustomer(null);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
              </Button>
            ) : null}

            <Button variant="outline" onClick={refresh} disabled={loading} className="bg-white">
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        </div>
      </div>

      {/* FILTROS (mismo estilo) */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<CalendarDays className="h-5 w-5 text-purple-600" />}
          title="Rango del Cuotero"
          subtitle="Filtrá por vencimiento de cuotas. Luego hacé click en un cliente para ver el calendario."
          right={
            <Button
              onClick={() => (view === "summary" ? loadSummary() : selectedCustomer ? loadMatrix(selectedCustomer.id, selectedCustomer.name) : null)}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Aplicar
            </Button>
          }
        />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
          <div>
            <Label>Desde</Label>
            <Input className="bg-white" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input className="bg-white" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          {view === "matrix" && matrix ? (
            <div className="md:col-span-2 flex flex-wrap gap-2 md:justify-end">
              <Chip tone="ok">Pagado: {money(matrixTotals.paidAmount)}</Chip>
              <Chip tone="warn">Vencido: {money(matrixTotals.overdueBalance)}</Chip>
              <Chip tone="neutral">Pendiente: {money(matrixTotals.openBalance)}</Chip>
            </div>
          ) : (
            <div className="md:col-span-2 text-sm text-muted-foreground md:text-right">
              {summaryRange ? (
                <span>
                  Rango cargado: <b>{summaryRange.from}</b> → <b>{summaryRange.to}</b>
                </span>
              ) : (
                <span>—</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* GRID */}
      {view === "summary" ? (
        <Card className="border-slate-200 p-6 shadow-sm">
          <SectionHeader
            icon={<Users className="h-5 w-5 text-purple-600" />}
            title="Clientes con cuotas"
            subtitle="Hacé click en una fila para ver el calendario."
          />

          <Separator className="my-4" />

          <div className="rounded-xl border bg-white p-2">
            <ThemeProvider theme={muiTheme}>
              <div style={{ height: 560, width: "100%" }}>
                <DataGrid
                  rows={summary}
                  getRowId={(r: CuoteroSummaryItem): GridRowId => r.customerId}
                  columns={summaryCols}
                  loading={loading}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10, page: 0 } },
                  }}
                  slots={{ toolbar: GridToolbar }}
                  disableRowSelectionOnClick
                  onRowClick={(p) => loadMatrix(p.row.customerId, p.row.customerName)}
                />
              </div>
            </ThemeProvider>
          </div>
        </Card>
      ) : (
        <Card className="border-slate-200 p-6 shadow-sm">
          <SectionHeader
            icon={<CalendarDays className="h-5 w-5 text-purple-600" />}
            title="Calendario de Cuotas"
            subtitle="Columnas por mes. Click en una celda o en el ojo para ver productos de la factura."
          />

          <Separator className="my-4" />

          <div className="rounded-xl border bg-white p-2">
            <ThemeProvider theme={muiTheme}>
              <div style={{ height: 560, width: "100%" }}>
                <DataGrid
                  rows={matrix?.rows ?? []}
                  getRowId={(r: MatrixRow): GridRowId => r.rowKey}
                  columns={matrixCols}
                  loading={loading}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10, page: 0 } },
                  }}
                  slots={{ toolbar: GridToolbar }}
                  disableRowSelectionOnClick
                />
              </div>
            </ThemeProvider>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-lg border px-2 py-1 font-semibold ${cellTone("OPEN")}`}>Pendiente</span>
            <span className={`rounded-lg border px-2 py-1 font-semibold ${cellTone("OVERDUE")}`}>Atrasado</span>
            <span className={`rounded-lg border px-2 py-1 font-semibold ${cellTone("PAID")}`}>Pagado (PDO)</span>
          </div>
        </Card>
      )}

      {/* DIALOG FACTURA */}
      <Dialog open={openInvoice} onOpenChange={setOpenInvoice}>
        <DialogContent className="sm:max-w-[860px] bg-white">
          <DialogHeader>
            <DialogTitle>
              Factura {invoiceDetail?.docNumber ?? ""} — {invoiceDetail?.customerName ?? ""}
            </DialogTitle>
          </DialogHeader>

          <Separator />

          {!invoiceDetail ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Chip tone="neutral">Fecha: {new Date(invoiceDetail.invoiceDate).toLocaleDateString("es-ES")}</Chip>
                <Chip tone="neutral">Total: {money(invoiceDetail.total)}</Chip>
                <Chip tone="info">Pagado: {money(invoiceDetail.paidAmount)}</Chip>
                <Chip tone={invoiceDetail.balance > 0 ? "warn" : "ok"}>Saldo: {money(invoiceDetail.balance)}</Chip>
              </div>

              <div>
                <div className="font-semibold mb-2">Productos</div>
                <div className="rounded-xl border bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2">Producto</th>
                        <th className="text-right p-2">Cant.</th>
                        <th className="text-right p-2">Precio</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoiceDetail.lines ?? []).map((l) => (
                        <tr key={l.id} className="border-t">
                          <td className="p-2">
                            {(l.productCode ? `${l.productCode} - ` : "")}
                            {l.productName ?? ""}
                          </td>
                          <td className="p-2 text-right">{money(l.quantity)}</td>
                          <td className="p-2 text-right">{money(l.unitPrice)}</td>
                          <td className="p-2 text-right">{money(l.lineTotal)}</td>
                        </tr>
                      ))}

                      {(invoiceDetail.lines ?? []).length === 0 && (
                        <tr>
                          <td className="p-3 text-muted-foreground" colSpan={4}>
                            Sin líneas. Verificá que <b>/salesinvoices/{`{id}`}</b> incluya <b>Lines</b>.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="bg-white" onClick={() => setOpenInvoice(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
