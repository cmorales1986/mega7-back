import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // ✅ Ahora el backend setea esta cookie HttpOnly
  const accessToken = req.cookies.get("access_token")?.value;

  const pathname = req.nextUrl.pathname;

  // ---- RUTAS PÚBLICAS (no requieren autenticación) ----
  const publicPaths = ["/login", "/register", "/forgotpassword", "/change-password"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // 1) Usuario autenticado NO debe volver a login/register
if (accessToken && isPublic && !pathname.startsWith("/change-password")) {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}

  // 2) Rutas públicas → acceso permitido
  if (isPublic) {
    return NextResponse.next();
  }

  // 3) Rutas privadas → requieren access_token
  if (!accessToken) {
    const url = new URL("/login", req.url);
    // opcional: recordá a dónde quería entrar
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Aplica a todo excepto assets internos y API routes internas de Next
export const config = {
  matcher: ["/((?!_next|static|favicon.ico|public|images|api).*)"],
};
