/**
 * Pantalla `/sin-acceso` — RG1 (Ola 3) + UIA-04 + Frente 1 (error de carga).
 *
 * Antes, un usuario autenticado sin rol efectivo era rebotado de `/inicio` a
 * `/` y de `/` otra vez a `/inicio`, produciendo un bucle infinito de
 * redirecciones. Ahora ese caso aterriza aquí: una página estática, sin
 * `Navigate`, que explica la situación y ofrece cerrar sesión.
 *
 * Tres variantes (ver `resolveSinAccesoVariant`):
 *  - "sin-rol-org": la cuenta no tiene rol ni organización.
 *  - "permiso-modulo": el rol es válido pero no alcanza para el módulo.
 *  - "error-carga": el perfil no cargó por una falla técnica → se ofrece
 *    "Reintentar" como acción principal en vez de pedir intervención de un
 *    administrador.
 */
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { Seo } from "@/components/shared/Seo";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  resolveSinAccesoVariant,
  esRolAdministrador,
} from "@/features/auth/utils/resolveSinAccesoVariant";
import { SinAccesoMensaje, SinAccesoAcciones } from "@/features/auth/components/SinAccesoContent";

interface SinAccesoState {
  motivo?: string;
  from?: string;
}

const COPY_POR_VARIANTE = {
  "error-carga": { titulo: "No pudimos cargar tu cuenta", Icono: AlertTriangle },
  "permiso-modulo": { titulo: "Sin acceso a este módulo", Icono: ShieldAlert },
  "sin-rol-org": { titulo: "Sin acceso", Icono: ShieldAlert },
} as const;

export default function SinAcceso() {
  const { state } = useLocation();
  const { effectiveRole, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const motivo = (state as SinAccesoState | null)?.motivo;
  const from = (state as SinAccesoState | null)?.from;

  const variant = resolveSinAccesoVariant({ motivo, effectiveRole });
  const esAdministrador = esRolAdministrador(effectiveRole);
  const { titulo, Icono } = COPY_POR_VARIANTE[variant];

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <Seo
        title={`${titulo} · Libre Carga`}
        description="Tu cuenta aún no tiene permisos asignados en Libre Carga."
        ogTitle={`${titulo} · Libre Carga`}
        ogDescription="Tu cuenta aún no tiene permisos asignados en Libre Carga."
      />
      <div className="max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icono className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-display text-foreground">{titulo}</h1>
        <SinAccesoMensaje
          variant={variant}
          effectiveRole={effectiveRole}
          esAdministrador={esAdministrador}
          from={from}
        />
        <SinAccesoAcciones
          variant={variant}
          effectiveRole={effectiveRole}
          esAdministrador={esAdministrador}
          from={from}
          onRetry={() => void handleRetry()}
          retrying={retrying}
        />
      </div>
    </div>
  );
}
