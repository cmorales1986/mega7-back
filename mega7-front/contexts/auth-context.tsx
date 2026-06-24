"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  permissions: string[];
  hasPermission: (code: string) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  permissions: [],
  hasPermission: () => false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const permissions = user?.permissions ?? [];

  const hasPermission = useCallback(
    (code: string) => {
      if (isAdmin) return true;
      return permissions.some((p) => p.toLowerCase() === code.toLowerCase());
    },
    [isAdmin, permissions]
  );

  return (
    <AuthContext.Provider value={{ user, isAdmin, permissions, hasPermission, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
