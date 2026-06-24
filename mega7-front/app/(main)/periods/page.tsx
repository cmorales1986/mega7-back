"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/use-permission";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

import { RefreshCcw, Plus, Lock, Unlock, CalendarDays } from "lucide-react";
import Swal from "sweetalert2";

// MUI DataGrid
import { DataGrid, GridColDef, GridRowId, GridToolbar } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { esES } from "@mui/x-data-grid/locales";
import { Label } from "@/components/ui/label";

const muiTheme = createTheme({}, esES);

type Period = {
  id: number;
  year: number;
  month: number;
  startDate: string; // ISO
  endDate: string; // ISO
  isOpen: boolean;
  isActive: boolean;
  createdAt?: string;
  closedAt?: string | null;
};

// ✅ Tipo de fila para DataGrid
type PeriodRow = Period & {
  monthName: string;
  statusText: string;
  activeText: string;
  startText: string;
  endText: string;
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PY");
};

// =====================
// UI helpers (mismo estilo)
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

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal create
  const [openModal, setOpenModal] = useState(false);
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get<Period[]>("/periods");
      setPeriods(res.data ?? []);
    } catch (err: any) {
      Swal.fire(
        "Error",
        err?.response?.data ?? "No se pudo cargar períodos.",
        "error"
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const rowsForGrid: PeriodRow[] = useMemo(() => {
    return (periods ?? []).map((p) => ({
      ...p,
      monthName: monthNames[(p.month ?? 1) - 1] ?? String(p.month ?? ""),
      statusText: p.isOpen ? "ABIERTO" : "CERRADO",
      activeText: p.isActive ? "Activo" : "Inactivo",
      startText: fmtDate(p.startDate),
      endText: fmtDate(p.endDate),
    }));
  }, [periods]);

  const getAxiosErrorMsg = (err: any) => {
    const msg = err?.response?.data;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
    return "Ocurrió un error.";
  };

  const openCreate = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setOpenModal(true);
  };

  const createPeriod = async () => {
    if (!year || year < 2000 || year > 2100) {
      Swal.fire("Validación", "Año inválido.", "warning");
      return;
    }
    if (!month || month < 1 || month > 12) {
      Swal.fire("Validación", "Mes inválido.", "warning");
      return;
    }

    try {
      await api.post("/periods", { year, month });
      Swal.fire("Creado", "Período creado correctamente.", "success");
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire("Error", getAxiosErrorMsg(err), "error");
    }
  };

  const closePeriod = async (p: PeriodRow) => {
    const res = await Swal.fire({
      title: "Cerrar período",
      text: `¿Cerrar ${p.year} - ${p.monthName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;

    try {
      await api.post(`/periods/${p.id}/close`);
      Swal.fire("OK", "Período cerrado.", "success");
      loadData();
    } catch (err: any) {
      Swal.fire("Error", getAxiosErrorMsg(err), "error");
    }
  };

  const openPeriod = async (p: PeriodRow) => {
    const res = await Swal.fire({
      title: "Reabrir período",
      text: `¿Reabrir ${p.year} - ${p.monthName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, reabrir",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;

    try {
      await api.post(`/periods/${p.id}/open`);
      Swal.fire("OK", "Período reabierto.", "success");
      loadData();
    } catch (err: any) {
      Swal.fire("Error", getAxiosErrorMsg(err), "error");
    }
  };

  const toggleActive = async (p: PeriodRow) => {
    const newActive = !p.isActive;

    const res = await Swal.fire({
      title: newActive ? "Activar período" : "Desactivar período",
      text: `¿${newActive ? "Activar" : "Desactivar"} ${p.year} - ${p.monthName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;

    try {
      await api.put(`/periods/${p.id}`, {
        year: p.year,
        month: p.month,
        isActive: newActive,
      });
      Swal.fire("OK", "Actualizado.", "success");
      loadData();
    } catch (err: any) {
      Swal.fire("Error", getAxiosErrorMsg(err), "error");
    }
  };

  const canCreate = usePermission("Periods.Create");
  const canClose = usePermission("Periods.Close");
  const canOpen = usePermission("Periods.Open");
  const canDeactivate = usePermission("Periods.Deactivate");

  const columns: GridColDef<PeriodRow>[] = [
    { field: "year", headerName: "Año", width: 110 },
    { field: "monthName", headerName: "Mes", width: 160 },
    { field: "startText", headerName: "Desde", width: 130 },
    { field: "endText", headerName: "Hasta", width: 130 },
    {
      field: "statusText",
      headerName: "Estado",
      width: 120,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <span
          className={`px-3 py-1 rounded-md text-white ${
            params.row.isOpen ? "bg-indigo-600" : "bg-gray-500"
          }`}
        >
          {params.row.isOpen ? "Abierto" : "Cerrado"}
        </span>
      ),
    },
    {
      field: "isActive",
      headerName: "Activo",
      width: 120,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <span
          className={`px-3 py-1 rounded-md text-white ${
            params.row.isActive ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {params.row.isActive ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 320,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => {
        const p = params.row;
        return (
          <div className="w-full h-full flex items-center justify-center gap-2">
            {p.isOpen ? (
              canClose && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white"
                  onClick={() => closePeriod(p)}
                  disabled={!p.isActive}
                  title={!p.isActive ? "Primero activá el período" : ""}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar
                </Button>
              )
            ) : (
              canOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white"
                  onClick={() => openPeriod(p)}
                  disabled={!p.isActive}
                  title={!p.isActive ? "Primero activá el período" : ""}
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Reabrir
                </Button>
              )
            )}

            {canDeactivate && (
              <Button
                variant="outline"
                size="sm"
                className="bg-white"
                onClick={() => toggleActive(p)}
              >
                {p.isActive ? "Desactivar" : "Activar"}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Chips / Stats
  const total = periods.length;
  const activeCount = periods.filter((p) => p.isActive).length;
  const openCount = periods.filter((p) => p.isOpen).length;
  const closedCount = total - openCount;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* PAGE HEADER (estilo premium) */}
      <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <CalendarDays className="h-5 w-5 text-purple-600" />
              </div>
              <h1 className="text-3xl font-semibold">Períodos</h1>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Apertura/cierre mensual para controlar operaciones.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="info">Total: {total}</Chip>
              <Chip tone="ok">Activos: {activeCount}</Chip>
              <Chip tone={openCount > 0 ? "ok" : "neutral"}>Abiertos: {openCount}</Chip>
              <Chip tone={closedCount > 0 ? "warn" : "neutral"}>Cerrados: {closedCount}</Chip>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadData} variant="outline" className="bg-white" disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>

            {canCreate && (
              <Button
                onClick={openCreate}
                disabled={loading}
                className="bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Período
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* LISTADO */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<CalendarDays className="h-5 w-5 text-purple-600" />}
          title="Listado de períodos"
          subtitle="Podés abrir/cerrar un período y activar/desactivar para permitir operaciones."
        />

        <Separator className="my-4" />

        <div className="rounded-xl border bg-white p-2">
          <ThemeProvider theme={muiTheme}>
            <div style={{ height: 560, width: "100%" }}>
              <DataGrid
                rows={rowsForGrid}
                columns={columns}
                loading={loading}
                pageSizeOptions={[5, 10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                getRowId={(r: PeriodRow): GridRowId => r.id}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
              />
            </div>
          </ThemeProvider>
        </div>
      </Card>

      {/* MODAL CREATE */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Nuevo Período</DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Año</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value || "0", 10))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Mes (1-12)</Label>
                <Input
                  className="bg-white"
                  type="number"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value || "0", 10))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="bg-white" onClick={() => setOpenModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={createPeriod}
                className="bg-[#C5A05A] hover:bg-[#b8934f] text-white"
              >
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
