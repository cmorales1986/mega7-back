/**
 * Convierte un error de Axios a un mensaje de texto legible.
 * Maneja 403 (sin permiso), 401 (sesión expirada), objetos JSON del backend,
 * strings planos y objetos desconocidos.
 */
export function toErrorMsg(e: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (!e || typeof e !== "object") return fallback;

  const err = e as any;
  const status: number = err?.response?.status ?? 0;
  const data = err?.response?.data;

  // ── Errores HTTP conocidos ────────────────────────────────────────────────
  if (status === 403) return "No tenés permiso para realizar esta acción.";
  if (status === 401) return "Tu sesión expiró. Volvé a iniciar sesión.";
  if (status === 404) return "El recurso no fue encontrado.";

  // ── Parsear la respuesta del backend ─────────────────────────────────────
  if (data !== null && data !== undefined) {
    if (typeof data === "string" && data.trim().length > 0) return data.trim();

    if (typeof data === "object") {
      // ASP.NET BadRequest con { "message": "..." }
      if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
      // ASP.NET ProblemDetails: { "title": "...", "detail": "..." }
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail.trim();
      if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
      // ASP.NET validation errors: { "errors": { "Field": ["msg"] } }
      if (data.errors && typeof data.errors === "object") {
        const msgs = Object.values(data.errors as Record<string, string[]>)
          .flat()
          .filter((m): m is string => typeof m === "string");
        if (msgs.length > 0) return msgs.join(" · ");
      }
    }
  }

  // ── Fallback al mensaje de axios / Error nativo ───────────────────────────
  if (typeof err.message === "string" && err.message.trim()) return err.message.trim();

  return fallback;
}
