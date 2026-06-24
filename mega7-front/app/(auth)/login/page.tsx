"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [userOrEmail, setUser] = useState("");
  const [password, setPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!userOrEmail || !password) {
      setError("Ingrese usuario/email y contraseña");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post("/auth/login", { userOrEmail, password });

      window.location.href = "/dashboard";
    } catch {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className="
        w-[420px] 
        shadow-2xl 
        rounded-xl 
        border 
        border-gray-200 
        bg-white/90 
        backdrop-blur
        animate-in 
        fade-in 
        slide-in-from-bottom-4
        duration-500
      "
    >
      <CardHeader>
        <div className="flex flex-col items-center space-y-2">
          <Image
            src="/images/icono_ligth.png"
            width={55}
            height={55}
            alt="Mega7 Logo"
            className="opacity-90"
          />
          <h1 className="text-2xl font-semibold text-gray-800">
            Iniciar Sesión
          </h1>
          <p className="text-sm text-gray-500">
            Accedé a tu panel de Mega7
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Usuario */}
        <Input
          placeholder="Usuario o Email"
          value={userOrEmail}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          disabled={loading}
        />

        {/* Password + ojito */}
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Botón login */}
        <Button
          className="w-full text-white font-medium py-2 rounded-lg"
          style={{ backgroundColor: "#C5A05A" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#A88446")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#C5A05A")
          }
          disabled={loading}
          onClick={handleLogin}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={18} />
              Ingresando...
            </span>
          ) : (
            "INGRESAR"
          )}
        </Button>

        {/* Registrar */}
        <Button
          variant="outline"
          className="w-full border-[#C5A05A] text-[#C5A05A] hover:bg-[#C5A05A]/10"
          onClick={() => (window.location.href = "/register")}
          disabled={loading}
        >
          Crear cuenta
        </Button>
      </CardContent>
    </Card>
  );
}
