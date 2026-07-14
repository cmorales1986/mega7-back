"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Circle, Wifi, WifiOff } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/contexts/auth-context";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ name, self }: { name: string; self: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white
        ${self ? "bg-[#C5A05A]" : "bg-slate-500"}`}
    >
      {getInitials(name)}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel() {
  const { user } = useAuth();
  const { messages, online, connected, unread, sendMessage, setOpen } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync open state con el hook (para limpiar badge)
  useEffect(() => {
    setOpen(isOpen);
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, setOpen]);

  // Auto-scroll al nuevo mensaje
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    await sendMessage(draft);
    setDraft("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Panel de chat */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-[1000] w-80 flex flex-col rounded-2xl shadow-2xl border border-gray-200 overflow-hidden bg-white"
          style={{ height: "460px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#C5A05A] to-[#d8b56c] text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-semibold text-sm">Chat del equipo</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Indicador de conexión */}
              <div className="flex items-center gap-1 text-xs opacity-80">
                {connected ? (
                  <><Wifi size={12} /><span>{online.length} en línea</span></>
                ) : (
                  <><WifiOff size={12} /><span>Conectando...</span></>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-full p-1 transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 bg-gray-50 min-h-0">
            {messages.length === 0 && (
              <p className="text-center text-gray-400 text-xs pt-8">
                No hay mensajes aún. ¡Decí hola! 👋
              </p>
            )}
            {messages.map((msg) => {
              const isSelf = msg.userId === user.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isSelf ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar name={msg.fullName} self={isSelf} />
                  <div className={`max-w-[200px] ${isSelf ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {!isSelf && (
                      <span className="text-[10px] text-gray-500 font-medium px-1">
                        {msg.fullName}
                      </span>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm break-words leading-snug
                        ${isSelf
                          ? "bg-[#C5A05A] text-white rounded-tr-sm"
                          : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm"
                        }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-gray-400 px-1">
                      {formatTime(msg.sentAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Usuarios en línea */}
          {online.length > 0 && (
            <div className="px-3 py-1.5 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-1 flex-wrap">
                <Circle size={6} className="text-emerald-500 fill-emerald-500 flex-shrink-0" />
                <span className="text-[10px] text-gray-500">
                  {online.map((u) => u.fullName.split(" ")[0]).join(", ")}
                </span>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-white flex-shrink-0">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí un mensaje..."
              maxLength={500}
              className="flex-1 text-sm border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-[#C5A05A] bg-gray-50 transition"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || !connected}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#C5A05A] text-white disabled:opacity-40 hover:bg-[#b8934f] transition flex-shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[1000] w-12 h-12 rounded-full bg-[#C5A05A] hover:bg-[#b8934f] text-white shadow-lg flex items-center justify-center transition hover:scale-105 active:scale-95"
        title="Chat del equipo"
      >
        <MessageCircle size={22} />
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
