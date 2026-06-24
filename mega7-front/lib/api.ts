import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * API Axios instance
 * - Usa proxy de Next (/api → backend .NET)
 * - Cookies HttpOnly (access_token / refresh_token)
 */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let queue: Array<(ok: boolean) => void> = [];

function flushQueue(ok: boolean) {
  queue.forEach((cb) => cb(ok));
  queue = [];
}

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout") ||
    url.includes("/auth/register") ||
    url.includes("/auth/change-password") ||
    url.includes("/auth/me")
  );
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as RetryConfig | undefined;
    if (!original) throw err;

    // ✅ 1) Si backend bloquea por password vencida → redirect
    if (err.response?.status === 403) {
      const data: any = err.response?.data;
      if (data?.error === "PASSWORD_EXPIRED" && typeof window !== "undefined") {
        window.location.href = "/change-password";
      }
      // igual tiramos error para cortar flujo actual
      throw err;
    }

    // 🔒 No manejar auth endpoints con refresh
    if (isAuthEndpoint(original.url)) {
      throw err;
    }

    // ✅ 2) Solo manejar 401 con refresh
    if (err.response?.status !== 401 || original._retry) {
      throw err;
    }

    original._retry = true;

    // ⏳ Si ya hay refresh en curso, esperar
    if (isRefreshing) {
      const ok = await new Promise<boolean>((resolve) => queue.push(resolve));
      if (!ok) throw err;
      return api(original);
    }

    isRefreshing = true;

    try {
      await api.post("/auth/refresh");
      flushQueue(true);
      return api(original);
    } catch {
      flushQueue(false);

      try {
        await api.post("/auth/logout");
      } catch {}

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }

      throw err;
    } finally {
      isRefreshing = false;
    }
  }
);
