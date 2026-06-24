"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export interface ChatMessage {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  text: string;
  sentAt: string;
}

export interface OnlineUser {
  username: string;
  fullName: string;
}

// En prod: NEXT_PUBLIC_API_BASE_URL = https://mega7-back-production.up.railway.app
// En dev:  NEXT_PUBLIC_API_BASE_URL = http://localhost:5063  (o el puerto de tu backend)
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const HUB_URL = BASE ? `${BASE}/hubs/chat` : "/hubs/chat";

export function useChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const connRef = useRef<signalR.HubConnection | null>(null);
  const openRef = useRef(false); // el panel está abierto?

  // Expone setter para que el panel pueda indicar que está abierto (limpia badge)
  const setOpen = useCallback((isOpen: boolean) => {
    openRef.current = isOpen;
    if (isOpen) setUnread(0);
  }, []);

  const connect = useCallback(async () => {
    if (!user || connRef.current) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        withCredentials: true,
        transport: signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on("ReceiveMessage", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!openRef.current) setUnread((n) => n + 1);
    });

    conn.on("OnlineUpdated", (list: OnlineUser[]) => setOnline(list));

    conn.onreconnected(() => setConnected(true));
    conn.onclose(() => setConnected(false));

    try {
      await conn.start();
      setConnected(true);
      connRef.current = conn;

      // Cargar historial
      const res = await api.get<ChatMessage[]>("/chat/history");
      setMessages(res.data);
    } catch {
      // Intento silencioso — la reconexión automática lo reintentará
    }
  }, [user]);

  useEffect(() => {
    connect();
    return () => {
      connRef.current?.stop();
      connRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback(async (text: string) => {
    if (!connRef.current || !text.trim()) return;
    await connRef.current.invoke("SendMessage", text.trim());
  }, []);

  return { messages, online, connected, unread, sendMessage, setOpen };
}
