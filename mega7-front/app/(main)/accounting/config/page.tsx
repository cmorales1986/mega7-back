"use client";

import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { toErrorMsg } from "@/lib/api-error";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageShell, Chip } from "@/components/ui/page-shell";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { Settings2, RefreshCcw, Save, CheckCircle2 } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type FlatAccount = {
  id: number; code: string; name: string;
  isTitle: boolean; type: string; isActive: boolean;
};

type GlobalCfg = {
  id: number; key: string; label: string; group: string;
  accountId: number | null; accountCode: string | null; accountName: string | null;
};

type CashBoxCfg = {
  id: number; name: string; isActive: boolean;
  accountId: number | null; accountCode: string | null; accountName: string | null;
};

type BankAccountCfg = {
  id: number; alias: string; accountNumber: string; currency: string; bankName: string | null;
  accountId: number | null; accountCode: string | null; accountName: string | null;
};

type TaxCfg = {
  id: number; name: string; rate: number;
  salesAccountId: number | null; salesAccountCode: string | null; salesAccountName: string | null;
  purchaseAccountId: number | null; purchaseAccountCode: string | null; purchaseAccountName: string | null;
};

type CategoryCfg = {
  id: number; code: string; name: string;
  revenueAccountId: number | null;   revenueAccountCode: string | null;   revenueAccountName: string | null;
  cogsAccountId: number | null;      cogsAccountCode: string | null;      cogsAccountName: string | null;
  inventoryAccountId: number | null; inventoryAccountCode: string | null; inventoryAccountName: string | null;
  purchaseAccountId: number | null;  purchaseAccountCode: string | null;  purchaseAccountName: string | null;
};

// ── Selector de cuenta reutilizable ──────────────────────────────────────────

function AccountSelect({
  value, accounts, onChange, placeholder = "Sin asignar",
}: {
  value: number | null;
  accounts: FlatAccount[];
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const movAccounts = useMemo(
    () => accounts.filter((a) => !a.isTitle && a.isActive),
    [accounts]
  );

  return (
    <Select
      value={value?.toString() ?? "none"}
      onValueChange={(v) => onChange(v === "none" ? null : parseInt(v))}
    >
      <SelectTrigger className="bg-white h-9 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="none">
          <span className="text-slate-400 italic">{placeholder}</span>
        </SelectItem>
        {movAccounts.map((a) => (
          <SelectItem key={a.id} value={a.id.toString()}>
            <span className="font-mono text-slate-500 mr-2 text-xs">{a.code}</span>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AccountingConfigPage() {
  const [accounts,     setAccounts]     = useState<FlatAccount[]>([]);
  const [globalCfg,    setGlobalCfg]    = useState<GlobalCfg[]>([]);
  const [cashBoxes,    setCashBoxes]    = useState<CashBoxCfg[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountCfg[]>([]);
  const [taxes,        setTaxes]        = useState<TaxCfg[]>([]);
  const [categories,   setCategories]   = useState<CategoryCfg[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Estado local de edición (copia mutable antes de guardar)
  const [localGlobal,      setLocalGlobal]      = useState<GlobalCfg[]>([]);
  const [localCashBoxes,   setLocalCashBoxes]   = useState<CashBoxCfg[]>([]);
  const [localBanks,       setLocalBanks]       = useState<BankAccountCfg[]>([]);
  const [localTaxes,       setLocalTaxes]       = useState<TaxCfg[]>([]);
  const [localCategories,  setLocalCategories]  = useState<CategoryCfg[]>([]);

  // ── Carga ──────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgRes, accRes] = await Promise.all([
        api.get("/accountingconfig"),
        api.get<FlatAccount[]>("/accounts/flat"),
      ]);

      const cfg = cfgRes.data;
      setAccounts(accRes.data ?? []);
      setGlobalCfg(cfg.global   ?? []);
      setCashBoxes(cfg.cashBoxes ?? []);
      setBankAccounts(cfg.bankAccounts ?? []);
      setTaxes(cfg.taxes ?? []);
      setCategories(cfg.categories ?? []);

      // Inicializar copias locales
      setLocalGlobal(cfg.global      ?? []);
      setLocalCashBoxes(cfg.cashBoxes ?? []);
      setLocalBanks(cfg.bankAccounts  ?? []);
      setLocalTaxes(cfg.taxes         ?? []);
      setLocalCategories(cfg.categories ?? []);
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo cargar la configuración"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Helpers de mutación local ──────────────────────────────────────────────

  const setGlobalAccount = (key: string, accountId: number | null) =>
    setLocalGlobal((prev) => prev.map((c) => c.key === key ? { ...c, accountId } : c));

  const setCashBoxAccount = (id: number, accountId: number | null) =>
    setLocalCashBoxes((prev) => prev.map((c) => c.id === id ? { ...c, accountId } : c));

  const setBankAccount = (id: number, accountId: number | null) =>
    setLocalBanks((prev) => prev.map((b) => b.id === id ? { ...b, accountId } : b));

  const setTaxSales = (id: number, accountId: number | null) =>
    setLocalTaxes((prev) => prev.map((t) => t.id === id ? { ...t, salesAccountId: accountId } : t));

  const setTaxPurchase = (id: number, accountId: number | null) =>
    setLocalTaxes((prev) => prev.map((t) => t.id === id ? { ...t, purchaseAccountId: accountId } : t));

  const setCatField = (id: number, field: keyof CategoryCfg, accountId: number | null) =>
    setLocalCategories((prev) => prev.map((c) => c.id === id ? { ...c, [field]: accountId } : c));

  // ── Guardar todo ──────────────────────────────────────────────────────────

  const saveAll = async () => {
    setSaving(true);
    try {
      // 1. Global
      await api.put("/accountingconfig/global",
        localGlobal.map((c) => ({ key: c.key, accountId: c.accountId }))
      );

      // 2. Cajas (solo las que cambiaron)
      for (const box of localCashBoxes) {
        const orig = cashBoxes.find((c) => c.id === box.id);
        if (orig?.accountId !== box.accountId)
          await api.put(`/accountingconfig/cashbox/${box.id}`, { accountId: box.accountId });
      }

      // 3. Bancos
      for (const bank of localBanks) {
        const orig = bankAccounts.find((b) => b.id === bank.id);
        if (orig?.accountId !== bank.accountId)
          await api.put(`/accountingconfig/bankaccount/${bank.id}`, { accountId: bank.accountId });
      }

      // 4. Impuestos
      for (const tax of localTaxes) {
        const orig = taxes.find((t) => t.id === tax.id);
        if (orig?.salesAccountId !== tax.salesAccountId || orig?.purchaseAccountId !== tax.purchaseAccountId)
          await api.put(`/accountingconfig/tax/${tax.id}`, {
            salesAccountId:    tax.salesAccountId,
            purchaseAccountId: tax.purchaseAccountId,
          });
      }

      // 5. Categorías
      for (const cat of localCategories) {
        const orig = categories.find((c) => c.id === cat.id);
        const changed =
          orig?.revenueAccountId   !== cat.revenueAccountId   ||
          orig?.cogsAccountId      !== cat.cogsAccountId      ||
          orig?.inventoryAccountId !== cat.inventoryAccountId ||
          orig?.purchaseAccountId  !== cat.purchaseAccountId;
        if (changed)
          await api.put(`/accountingconfig/category/${cat.id}`, {
            revenueAccountId:   cat.revenueAccountId,
            cogsAccountId:      cat.cogsAccountId,
            inventoryAccountId: cat.inventoryAccountId,
            purchaseAccountId:  cat.purchaseAccountId,
          });
      }

      Swal.fire("OK", "Configuración contable guardada correctamente.", "success");
      await loadAll();
    } catch (e) {
      Swal.fire("Error", toErrorMsg(e, "No se pudo guardar la configuración"), "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Agrupar global por grupo ───────────────────────────────────────────────

  const globalGroups = useMemo(() => {
    const map = new Map<string, GlobalCfg[]>();
    for (const c of localGlobal) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [localGlobal]);

  // ── Contar asignados ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const gTotal  = localGlobal.length;
    const gDone   = localGlobal.filter((c) => c.accountId).length;
    const cbDone  = localCashBoxes.filter((c) => c.accountId).length;
    const bkDone  = localBanks.filter((b) => b.accountId).length;
    const txDone  = localTaxes.filter((t) => t.salesAccountId || t.purchaseAccountId).length;
    const catDone = localCategories.filter((c) => c.revenueAccountId).length;
    return { gTotal, gDone, cbDone, bkDone, txDone, catDone };
  }, [localGlobal, localCashBoxes, localBanks, localTaxes, localCategories]);

  const GROUP_COLORS: Record<string, string> = {
    Ventas:     "text-emerald-600 bg-emerald-50 border-emerald-200",
    Compras:    "text-blue-600 bg-blue-50 border-blue-200",
    Créditos:   "text-purple-600 bg-purple-50 border-purple-200",
    Tesorería:  "text-amber-600 bg-amber-50 border-amber-200",
    Cierre:     "text-slate-600 bg-slate-100 border-slate-300",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell
      icon={<Settings2 className="h-5 w-5 text-emerald-600" />}
      title="Configuración Contable"
      subtitle="Asociá cada caja, banco e impuesto a su cuenta contable. Los asientos automáticos usarán estos valores."
      chips={
        <>
          <Chip tone="info">Global: {stats.gDone}/{stats.gTotal}</Chip>
          <Chip tone={stats.cbDone === localCashBoxes.length ? "ok" : "warn"}>
            Cajas: {stats.cbDone}/{localCashBoxes.length}
          </Chip>
          <Chip tone={stats.bkDone === localBanks.length ? "ok" : "warn"}>
            Bancos: {stats.bkDone}/{localBanks.length}
          </Chip>
          <Chip tone={stats.catDone === localCategories.length ? "ok" : "warn"}>
            Categorías: {stats.catDone}/{localCategories.length}
          </Chip>
        </>
      }
      right={
        <>
          <Button onClick={loadAll} variant="outline" className="bg-white" disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button
            onClick={saveAll} disabled={saving || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando…" : "Guardar todo"}
          </Button>
        </>
      }
    >

      {/* ── 1. Cajas ────────────────────────────────────────────────────── */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-amber-600" />}
          title="Cajas"
          subtitle="Cada caja debe apuntar a su cuenta contable de disponibilidades (ej: Caja Principal → 1.01.01.001)."
        />
        <Separator className="my-4" />

        {localCashBoxes.length === 0 ? (
          <p className="text-sm text-slate-400">No hay cajas registradas.</p>
        ) : (
          <div className="divide-y rounded-xl border overflow-hidden">
            {localCashBoxes.map((box) => (
              <div key={box.id} className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-700 text-xs font-bold">{box.name[0]}</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{box.name}</div>
                  {!box.isActive && <span className="text-xs text-slate-400">Inactiva</span>}
                </div>
                <div className="w-72">
                  <AccountSelect
                    value={box.accountId}
                    accounts={accounts}
                    onChange={(id) => setCashBoxAccount(box.id, id)}
                  />
                </div>
                <div className="w-6">
                  {box.accountId
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <div className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 2. Cuentas Bancarias ─────────────────────────────────────────── */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-blue-600" />}
          title="Cuentas Bancarias"
          subtitle="Cada cuenta bancaria debe apuntar a su cuenta contable (ej: BBVA CTA CTE → 1.01.01.003)."
        />
        <Separator className="my-4" />

        {localBanks.length === 0 ? (
          <p className="text-sm text-slate-400">No hay cuentas bancarias registradas.</p>
        ) : (
          <div className="divide-y rounded-xl border overflow-hidden">
            {localBanks.map((bank) => (
              <div key={bank.id} className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 text-xs font-bold">{(bank.bankName ?? bank.alias)[0]}</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{bank.alias}</div>
                  <div className="text-xs text-slate-400">
                    {bank.bankName} · {bank.accountNumber} · {bank.currency}
                  </div>
                </div>
                <div className="w-72">
                  <AccountSelect
                    value={bank.accountId}
                    accounts={accounts}
                    onChange={(id) => setBankAccount(bank.id, id)}
                  />
                </div>
                <div className="w-6">
                  {bank.accountId
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <div className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 3. Categorías de Productos ───────────────────────────────────── */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-emerald-600" />}
          title="Categorías de Productos"
          subtitle="Determinación de cuentas por categoría: ingresos, costo de ventas, inventario y compras. El sistema usará estas cuentas al generar asientos automáticos."
        />
        <Separator className="my-4" />

        {localCategories.length === 0 ? (
          <p className="text-sm text-slate-400">No hay categorías activas.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[200px_1fr_1fr_1fr_1fr_24px] gap-3 px-4 py-2 bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b">
              <span>Categoría</span>
              <span>Ingresos (Ventas)</span>
              <span>Costo de Ventas</span>
              <span>Inventario</span>
              <span>Compras</span>
              <span />
            </div>

            {localCategories.map((cat) => {
              const allSet = cat.revenueAccountId && cat.cogsAccountId && cat.inventoryAccountId;
              return (
                <div
                  key={cat.id}
                  className="grid grid-cols-[200px_1fr_1fr_1fr_1fr_24px] gap-3 items-center px-4 py-3 border-b last:border-0 bg-white hover:bg-slate-50"
                >
                  {/* Nombre categoría */}
                  <div>
                    <div className="text-sm font-semibold">{cat.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{cat.code}</div>
                  </div>

                  {/* Ingresos */}
                  <AccountSelect
                    value={cat.revenueAccountId}
                    accounts={accounts}
                    placeholder="Cuenta de ingresos…"
                    onChange={(id) => setCatField(cat.id, "revenueAccountId", id)}
                  />

                  {/* Costo de Ventas */}
                  <AccountSelect
                    value={cat.cogsAccountId}
                    accounts={accounts}
                    placeholder="Costo de ventas…"
                    onChange={(id) => setCatField(cat.id, "cogsAccountId", id)}
                  />

                  {/* Inventario */}
                  <AccountSelect
                    value={cat.inventoryAccountId}
                    accounts={accounts}
                    placeholder="Inventario…"
                    onChange={(id) => setCatField(cat.id, "inventoryAccountId", id)}
                  />

                  {/* Compras */}
                  <AccountSelect
                    value={cat.purchaseAccountId}
                    accounts={accounts}
                    placeholder="Compras…"
                    onChange={(id) => setCatField(cat.id, "purchaseAccountId", id)}
                  />

                  {/* Indicador */}
                  <div>
                    {allSet
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <div className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-400 mt-3">
          * Si una categoría no tiene cuenta asignada, el sistema usará las cuentas globales como fallback.
          La cuenta de Compras es opcional para categorías de servicios (sin inventario).
        </p>
      </Card>

      {/* ── 4. Impuestos ─────────────────────────────────────────────────── */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-red-500" />}
          title="Impuestos"
          subtitle="Cada impuesto necesita dos cuentas: IVA Débito Fiscal (ventas) e IVA Crédito Fiscal (compras)."
        />
        <Separator className="my-4" />

        {localTaxes.length === 0 ? (
          <p className="text-sm text-slate-400">No hay impuestos registrados.</p>
        ) : (
          <div className="divide-y rounded-xl border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-4 px-4 py-2 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <span>Impuesto</span>
              <span>Cuenta Ventas (Débito Fiscal)</span>
              <span>Cuenta Compras (Crédito Fiscal)</span>
              <span />
            </div>
            {localTaxes.map((tax) => (
              <div key={tax.id} className="grid grid-cols-[1fr_1fr_1fr_24px] gap-4 items-center px-4 py-3 bg-white hover:bg-slate-50">
                <div>
                  <div className="text-sm font-semibold">{tax.name}</div>
                  <div className="text-xs text-slate-400">{tax.rate}%</div>
                </div>
                <AccountSelect
                  value={tax.salesAccountId}
                  accounts={accounts}
                  placeholder="IVA Débito Fiscal…"
                  onChange={(id) => setTaxSales(tax.id, id)}
                />
                <AccountSelect
                  value={tax.purchaseAccountId}
                  accounts={accounts}
                  placeholder="IVA Crédito Fiscal…"
                  onChange={(id) => setTaxPurchase(tax.id, id)}
                />
                <div>
                  {(tax.salesAccountId && tax.purchaseAccountId)
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <div className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 4. Configuración Global ──────────────────────────────────────── */}
      <Card className="border-slate-200 p-6 shadow-sm">
        <SectionHeader
          icon={<Settings2 className="h-5 w-5 text-purple-600" />}
          title="Cuentas Globales"
          subtitle="Cuentas genéricas que aplican a todos los documentos (Clientes, Proveedores, Ventas, Costo, etc.)."
        />
        <Separator className="my-4" />

        <div className="space-y-6">
          {globalGroups.map(([group, items]) => (
            <div key={group}>
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold mb-3 ${GROUP_COLORS[group] ?? "bg-slate-100 text-slate-600 border-slate-300"}`}>
                {group}
              </div>
              <div className="divide-y rounded-xl border overflow-hidden">
                {items.map((cfg) => (
                  <div key={cfg.key} className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{cfg.label}</div>
                      <div className="text-xs text-slate-400 font-mono">{cfg.key}</div>
                    </div>
                    <div className="w-72">
                      <AccountSelect
                        value={cfg.accountId}
                        accounts={accounts}
                        onChange={(id) => setGlobalAccount(cfg.key, id)}
                      />
                    </div>
                    <div className="w-6">
                      {cfg.accountId
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <div className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

    </PageShell>
  );
}
