/**
 * Copy y acciones específicas de cada variante de `/sin-acceso`.
 * Extraído de `SinAcceso.tsx` para mantener el límite de 200 líneas y aislar
 * la lógica de copy (fácil de auditar/traducir) de la maquetación general.
 */
import { Link, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { Home, LifeBuoy, LogOut, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutCurrentSession } from "@/lib/auth/signOut";
import { obtenerEtiquetaRol } from "@/lib/ui/uiMappings";
import type { AppRole } from "@/types/appRole";
import type { SinAccesoVariant } from "@/features/auth/utils/resolveSinAccesoVariant";

interface SinAccesoContentProps {
  variant: SinAccesoVariant;
  effectiveRole: AppRole | null;
  esAdministrador: boolean;
  from?: string;
  onRetry: () => void;
  retrying: boolean;
}

function useMensaje({ variant, effectiveRole, esAdministrador, from }: Omit<SinAccesoContentProps, "onRetry" | "retrying">) {
  if (variant === "error-carga") {
    return esAdministrador
      ? "No pudimos cargar tu perfil de administrador por un problema técnico. Reintenta; si el problema persiste, contacta a soporte."
      : "No pudimos cargar los permisos de tu cuenta por un problema técnico (no es un tema de acceso). Reintenta en unos segundos.";
  }
  if (variant === "permiso-modulo") {
    // VB-09: no exponemos la ruta cruda al usuario y, si es backoffice interno
    // de Libre Carga (/admin*), no pedimos "habla con un administrador"
    // (quien lo intenta suele ser ya administrador de su organización).
    const esModuloInterno = Boolean(from?.startsWith("/admin"));
    return (
      <>
        Tu cuenta está activa con el rol <strong>{obtenerEtiquetaRol(effectiveRole)}</strong>,
        pero ese rol no tiene permiso para entrar a esta sección.{" "}
        {esModuloInterno
          ? "Esta sección es exclusiva del equipo de Libre Carga; si necesitas algo de aquí, contacta a soporte de Libre Carga."
          : "Si crees que es un error, pide a un administrador que ajuste tus permisos."}
      </>
    );
  }
  return "Tu cuenta está activa, pero todavía no tiene un rol ni una organización asignada. Pide a un administrador de tu empresa que te dé de alta para poder entrar.";
}

export function SinAccesoMensaje(props: Omit<SinAccesoContentProps, "onRetry" | "retrying">) {
  return <p className="text-body text-muted-foreground">{useMensaje(props)}</p>;
}

export function SinAccesoAcciones({ variant, esAdministrador, onRetry, retrying }: SinAccesoContentProps) {
  const navigate = useNavigate();
  /**
   * v13.819.1 — Antes el signOut limpiaba la sesión pero la pantalla se quedaba
   * en `/sin-acceso` con el mensaje genérico hasta navegar a mano. Ahora la
   * salida es determinista: cerrar sesión aterriza en `/login`.
   */
  const cerrarSesion = useCallback(async () => {
    await signOutCurrentSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  if (variant === "error-carga") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={onRetry} disabled={retrying}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          Reintentar
        </Button>
        <Button variant="outline" asChild>
          <Link to="/ayuda">
            <LifeBuoy className="mr-2 h-4 w-4" aria-hidden /> Ver ayuda
          </Link>
        </Button>
        <Button variant="outline" onClick={() => void cerrarSesion()}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden /> Cerrar sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      {variant === "permiso-modulo" && (
        <Button asChild>
          <Link to="/inicio">
            <Home className="mr-2 h-4 w-4" aria-hidden /> Volver al inicio
          </Link>
        </Button>
      )}
      {esAdministrador && variant === "sin-rol-org" ? (
        <Button asChild>
          <Link to="/admin">
            <Home className="mr-2 h-4 w-4" aria-hidden /> Ir a administración
          </Link>
        </Button>
      ) : null}
      <Button variant="outline" asChild>
        <Link to="/ayuda">
          <LifeBuoy className="mr-2 h-4 w-4" aria-hidden /> Ver ayuda
        </Link>
      </Button>
      <Button
        variant={variant === "permiso-modulo" || esAdministrador ? "outline" : "default"}
        onClick={() => void cerrarSesion()}
      >
        <LogOut className="mr-2 h-4 w-4" aria-hidden /> Cerrar sesión
      </Button>
    </div>
  );
}
