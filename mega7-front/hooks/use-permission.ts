"use client";

import { useAuth } from "@/contexts/auth-context";

/**
 * Verifica si el usuario tiene un permiso específico.
 * ADMIN siempre retorna true.
 *
 * Uso:
 *   const canCreate = usePermission("APInvoices.Create");
 *   {canCreate && <Button>Nuevo</Button>}
 */
export function usePermission(code: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(code);
}

/**
 * Verifica si el usuario tiene TODOS los permisos listados.
 */
export function usePermissions(...codes: string[]): boolean {
  const { hasPermission } = useAuth();
  return codes.every((c) => hasPermission(c));
}

/**
 * Verifica si el usuario tiene AL MENOS UNO de los permisos listados.
 */
export function useAnyPermission(...codes: string[]): boolean {
  const { hasPermission } = useAuth();
  return codes.some((c) => hasPermission(c));
}
