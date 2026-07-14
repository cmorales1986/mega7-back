"use client";

import { useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    setSuccess(null);

    if (!username || !fullName || !email || !password || !confirm) {
      setError("Complete todos los campos.");
      return;
    }

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/auth/register", {
        username,
        fullName,
        email,
        password,
        // role NO se envía → backend pone VENTAS
      });

      setSuccess("Usuario creado correctamente. Ya puede iniciar sesión.");

      // limpiar formulario
      setUsername("");
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirm("");

      // redirigir luego de un breve delay
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (e: any) {
      const msg =
        e?.response?.data ||
        "No se pudo registrar el usuario.";
      setError(typeof msg === "string" ? msg : "Error al registrar.");
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
            Crear Cuenta
          </h1>
          <p className="text-sm text-gray-500">
            Registro de usuario Mega7
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />

        <Input
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
        />

        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        {/* Password */}
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Confirmar contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
        />

        {/* Mensajes */}
        {error && (
          <div className="text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-600 text-center">
            {success}
          </div>
        )}

        {/* Botón registrar */}
        <Button
          className="w-full text-white font-medium py-2 rounded-lg"
          style={{ backgroundColor: "#C5A05A" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#b8934f")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#C5A05A")
          }
          disabled={loading}
          onClick={handleRegister}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={18} />
              Registrando...
            </span>
          ) : (
            "REGISTRAR"
          )}
        </Button>

        {/* Volver a login */}
        <Button
          variant="outline"
          className="w-full border-[#C5A05A] text-[#C5A05A] hover:bg-[#C5A05A]/10"
          onClick={() => (window.location.href = "/login")}
          disabled={loading}
        >
          Volver al login
        </Button>
      </CardContent>
    </Card>
  );
}
