"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { menu, type MenuItem } from "./sidebar-data";
import { useAuth } from "@/contexts/auth-context";

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [tempOpen, setTempOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const showOpen = open || tempOpen;

  // Filtra ítems adminOnly según el rol
  const visibleMenu = useMemo(
    () => menu.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  // Detecta qué grupo debería estar expandido según la ruta actual
  const groupToExpand = useMemo(() => {
    const group = visibleMenu.find(
      (m) => m.children?.some((c) => pathname.startsWith(c.href)) === true
    );
    return group?.title ?? null;
  }, [pathname, visibleMenu]);

  // Auto-expande el grupo correcto cuando navegas
  useEffect(() => {
    if (!showOpen) return;
    if (groupToExpand) setExpanded(groupToExpand);
  }, [groupToExpand, showOpen]);

  const collapseSidebar = () => {
    setOpen(false);
    setExpanded(null);
  };

  return (
    <aside
      className={`
        bg-white border-r shadow-sm transition-all duration-300 h-screen relative
        ${showOpen ? "w-64" : "w-20"}
      `}
      onMouseEnter={() => { if (!open) setTempOpen(true); }}
      onMouseLeave={() => { if (!open) setTempOpen(false); }}
    >
      {/* HEADER */}
      <div
        className={`flex flex-col items-center border-b transition-all duration-300
          ${showOpen ? "py-6 gap-2" : "py-4"}
        `}
      >
        <div
          className={`
            flex items-center justify-center rounded-full border-2 border-[#2563eb]
            bg-white transition-all duration-300 overflow-hidden
            ${showOpen ? "w-20 h-20" : "w-12 h-12"}
          `}
        >
          <img
            src="/images/icono_ligth.png"
            alt="Mega7 Logo"
            className={`opacity-90 transition-all duration-300 ${showOpen ? "w-12 h-12" : "w-8 h-8"}`}
          />
        </div>

        {showOpen && <p className="text-xl font-bold text-gray-800">Mega7</p>}

        <button
          onClick={() => { if (open) collapseSidebar(); else setOpen(true); }}
          className="absolute right-[-14px] top-10 bg-white border rounded-full shadow p-1 hover:bg-gray-100 transition"
        >
          <ChevronLeft
            className={`transition-transform ${open ? "" : "rotate-180"}`}
            size={20}
          />
        </button>
      </div>

      {/* MENU */}
      <div className="overflow-y-auto" style={{ height: "calc(100vh - 160px)" }}>
        <nav className="p-3 space-y-1">
          {visibleMenu.map((item: MenuItem) => {
            if (item.isSection) {
              return (
                <div key={item.title} className="pt-3">
                  <div className="px-3">
                    <div className="h-[1px] bg-gray-200" />
                  </div>
                  {showOpen && (
                    <div className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                      {item.title}
                    </div>
                  )}
                </div>
              );
            }

            const isGroupActive =
              item.children?.some((c) => pathname.startsWith(c.href)) === true;

            return (
              <div key={item.title}>
                {!item.children && (
                  <SidebarItem
                    href={item.href!}
                    icon={item.icon}
                    label={item.title}
                    color={item.color}
                    open={showOpen}
                    active={pathname === item.href}
                  />
                )}

                {item.children && (
                  <div>
                    <button
                      onClick={() =>
                        setExpanded(expanded === item.title ? null : item.title)
                      }
                      className={`
                        flex items-center w-full gap-3 p-3 rounded transition
                        ${isGroupActive ? "bg-gray-100 font-semibold" : "hover:bg-gray-100"}
                      `}
                    >
                      <item.icon className={item.color} size={20} />
                      {showOpen && (
                        <span className="text-sm font-semibold">{item.title}</span>
                      )}
                      {showOpen && (
                        <ChevronDown
                          className={`ml-auto transition-transform ${
                            expanded === item.title ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>

                    {expanded === item.title && showOpen && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <SidebarItem
                            key={child.title}
                            href={child.href}
                            icon={child.icon}
                            label={child.title}
                            open={true}
                            active={pathname === child.href}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {!open && tempOpen && (
        <div className="absolute top-0 bottom-0 left-full right-0 bg-black/20 backdrop-blur-sm z-[999] pointer-events-none" />
      )}
    </aside>
  );
}

function SidebarItem({ href, icon: Icon, label, open, active, color }: {
  href: string; icon: any; label: string; open: boolean; active: boolean; color?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 p-3 rounded transition
        ${active ? "bg-gray-200 font-bold" : "hover:bg-gray-100"}
      `}
    >
      <Icon size={20} className={color ?? "text-gray-600"} />
      {open && <span className="text-sm">{label}</span>}
    </Link>
  );
}
