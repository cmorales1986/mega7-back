"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import { ChevronDown, LogOut, User, Users, Settings, Shield, BarChart3, Calculator } from "lucide-react";
import { NotificationBell } from "@/components/navbar/notification-bell";
import { ReportsSidePanel } from "@/components/ui/reports-side-panel";
import { PriceSimulatorSheet } from "@/components/ui/price-simulator-sheet";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [reportsOpen, setReportsOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const title = useMemo(() => {
    const clean = pathname.replace("/", "");
    if (!clean) return "Dashboard";
    return clean
      .split("/")
      .filter(Boolean)
      .join(" / ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }, [pathname]);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // aunque falle, forzamos salida
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const displayName = user?.fullName?.trim() || "Cuenta";
  const role = (user?.role || "").toUpperCase();

  return (
    <>
    <header
      className="w-full h-16 flex items-center justify-between px-6 border-b shadow
        bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white"
    >
      <h1 className="text-lg font-semibold tracking-wide">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Reportes */}
        <button
          onClick={() => setReportsOpen(true)}
          title="Reportes"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition shadow"
        >
          <BarChart3 size={18} />
        </button>

        {/* Simulador de precios */}
        <button
          onClick={() => setPriceOpen(true)}
          title="Simulador de precios"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition shadow"
        >
          <Calculator size={18} />
        </button>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              className="bg-white/15 hover:bg-white/20 text-white border border-white/20 rounded-full px-4 h-10"
            >
              <User className="mr-2" size={18} />
              <span className="max-w-[220px] truncate">{displayName}</span>
              <ChevronDown className="ml-2" size={18} />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 bg-white text-gray-900 border border-gray-200 shadow-xl rounded-xl p-1"
          >
            <DropdownMenuLabel className="text-xs text-gray-600 px-2 py-2">
              <div className="font-medium text-gray-900">{user?.email || "—"}</div>
              {role ? <div className="text-gray-500">({role})</div> : null}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {isAdmin && (
              <>
                <DropdownMenuItem
                  onClick={() => router.push("/users")}
                  className="hover:cursor-pointer"
                >
                  <Users className="mr-2" size={18} />
                  Usuarios
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/settings/permissions")}
                  className="hover:cursor-pointer"
                >
                  <Shield className="mr-2" size={18} />
                  Permisos
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuItem
              onClick={() => router.push("/profile")}
              className="hover:cursor-pointer"
            >
              <Settings className="mr-2" size={18} />
              Perfil
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={logout}
              className="text-red-600 focus:text-red-600 hover:cursor-pointer hover:bg-red-50"
            >
              <LogOut className="mr-2" size={18} />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <ReportsSidePanel open={reportsOpen} onClose={() => setReportsOpen(false)} />
    <PriceSimulatorSheet open={priceOpen} onClose={() => setPriceOpen(false)} />
  </>
  );
}
