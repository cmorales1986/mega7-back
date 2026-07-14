"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [meLoading, setMeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Esta página requiere estar logueado
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.get("/auth/me");
        // Si no requiere cambio, lo mandamos al dashboard
        if (mounted && !res.data?.mustChangePassword) {
          window.location.href = "/dashboard";
        }
      } catch {
        // no está logueado
        if (mounted) window.location.href = "/login";
      } finally {
        if (mounted) setMeLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = async () => {
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirm) {
      setError("Complete todos los campos.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setSuccess("Contraseña actualizada. Redirigiendo...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 900);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        "No se pudo cambiar la contraseña.";
      setError(typeof msg === "string" ? msg : "Error al cambiar contraseña.");
    } finally {
      setLoading(false);
    }
  };

  if (meLoading) {
    return (
      <Card className="w-[420px] shadow-2xl rounded-xl border border-gray-200 bg-white/90 backdrop-blur">
        <CardContent className="py-10 flex items-center justify-center">
          <span className="flex items-center gap-2 text-gray-700">
            <Loader2 className="animate-spin" size={18} />
            Cargando...
          </span>
        </CardContent>
      </Card>
    );
  }

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
            Cambiar contraseña
          </h1>
          <p className="text-sm text-gray-500 text-center">
            Por seguridad, debés actualizar tu contraseña para continuar.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            placeholder="Contraseña actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Input
          type={show ? "text" : "password"}
          placeholder="Nueva contraseña (mín. 8, mayús, minús, número)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />

        <Input
          type={show ? "text" : "password"}
          placeholder="Confirmar nueva contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
        />

        {error && <div className="text-sm text-red-600 text-center">{error}</div>}
        {success && (
          <div className="text-sm text-green-600 text-center">{success}</div>
        )}

        <Button
          className="w-full text-white font-medium py-2 rounded-lg"
          style={{ backgroundColor: "#2563eb" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#1d4ed8")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#2563eb")
          }
          disabled={loading}
          onClick={handleChange}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={18} />
              Guardando...
            </span>
          ) : (
            "ACTUALIZAR"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
