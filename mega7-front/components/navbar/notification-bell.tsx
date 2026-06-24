"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, CheckCheck, Circle, X } from "lucide-react";

type NotificationDto = {
  key: string;
  title: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  count: number;
  href?: string | null;
  createdAt: string; // ISO
  isRead: boolean;
};

type SummaryDto = {
  unreadCount: number;
  items: NotificationDto[];
};

function severityBadge(sev: NotificationDto["severity"]) {
  switch (sev) {
    case "critical":
      return "bg-red-600/90 text-white";
    case "high":
      return "bg-orange-500/90 text-white";
    case "medium":
      return "bg-amber-500/90 text-white";
    case "low":
      return "bg-slate-600/80 text-white";
    default:
      return "bg-gray-600/70 text-white";
  }
}

export function NotificationBell() {
  const router = useRouter();

  const [data, setData] = useState<SummaryDto>({ unreadCount: 0, items: [] });
  const [loading, setLoading] = useState(false);

  const hasUnread = data.unreadCount > 0;

  const badgeText = useMemo(() => {
    if (!hasUnread) return "";
    return data.unreadCount > 99 ? "99+" : String(data.unreadCount);
  }, [hasUnread, data.unreadCount]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications/summary");
      setData(res.data);
    } catch {
      // no rompemos el navbar
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (mounted) await load();
    })();

    const t = setInterval(() => {
      load();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const markRead = async (key: string) => {
    try {
      await api.post("/notifications/mark-read", JSON.stringify(key), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      await load();
    } catch {
      // ignore
    }
  };

  const dismiss = async (key: string, minutes?: number) => {
    try {
      await api.post(
        "/notifications/dismiss",
        { key, minutes },
        { headers: { "Content-Type": "application/json" } }
      );
      await load();
    } catch {
      // ignore
    }
  };

  const onClickItem = async (n: NotificationDto) => {
    await markRead(n.key);
    await load();

    if (n.href) {
      router.push(n.href);
      router.refresh();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="
            relative bg-white/15 hover:bg-white/20 text-white border border-white/20
            rounded-full h-10 w-10 p-0
          "
          title="Notificaciones"
        >
          <Bell size={18} />
          {hasUnread && (
            <span
              className="
                absolute -top-1 -right-1 min-w-[20px] h-5 px-1
                rounded-full text-[11px] font-semibold
                bg-red-600 text-white flex items-center justify-center
                border border-white/30
              "
            >
              {badgeText}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[380px] bg-white text-gray-900 border border-gray-200 shadow-xl rounded-xl p-2"
      >
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="p-0 text-sm">
            Notificaciones
            {loading ? (
              <span className="ml-2 text-xs text-gray-500">Actualizando…</span>
            ) : null}
          </DropdownMenuLabel>

          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 rounded-lg"
            onClick={markAllRead}
            disabled={data.items.length === 0}
            title="Marcar todo como leído"
          >
            <CheckCheck size={16} className="mr-2" />
            <span className="text-xs">Leer todo</span>
          </Button>
        </div>

        <DropdownMenuSeparator />

        {data.items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-gray-600">
            No tenés notificaciones por ahora.
          </div>
        ) : (
          <ScrollArea className="h-[360px]">
            <div className="flex flex-col">
              {data.items.map((n, idx) => (
                <div key={n.key}>
                  {/* ✅ NO usar <button> acá para evitar button dentro de button */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onClickItem(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onClickItem(n);
                    }}
                    className="
                      w-full text-left px-3 py-3 rounded-lg
                      hover:bg-gray-50 transition
                      flex gap-3 cursor-pointer
                      outline-none focus:ring-2 focus:ring-blue-200
                    "
                  >
                    <div className="pt-1">
                      {n.isRead ? (
                        <Circle size={10} className="text-gray-300" />
                      ) : (
                        <Circle size={10} className="text-blue-600 fill-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">
                          {n.title}
                        </span>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${severityBadge(
                            n.severity
                          )}`}
                        >
                          {n.severity.toUpperCase()}
                        </span>

                        {n.count > 0 ? (
                          <span className="ml-auto text-xs text-gray-600">
                            {n.count}
                          </span>
                        ) : (
                          <span className="ml-auto" />
                        )}

                        {/* ✅ X descartar */}
                        <button
                          type="button"
                          className="ml-2 rounded-md p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-800"
                          title="Descartar"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const minutes = n.severity === "critical" ? 30 : 8 * 60;
                            dismiss(n.key, minutes);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {n.message}
                      </div>

                      {n.href ? (
                        <div className="text-[11px] text-blue-600 mt-1">
                          Ver detalle →
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {idx < data.items.length - 1 ? (
                    <Separator className="my-1" />
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
