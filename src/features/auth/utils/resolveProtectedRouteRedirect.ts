/**
 * Resuelve la ruta de redirección para `ProtectedRoute` en función del rol
 * global, la organización y la ruta actual. Función pura — no toca React ni
 * router. Devuelve `null` si la navegación actual es válida.
 *
 * Extraído de `ProtectedRoute.tsx` (13.133.1) para bajar la complejidad
 * ciclomática del componente bajo el umbral de ESLint (max 16).
 */
import type { AppRole } from "@/types/appRole";

interface OrganizationLike {
  onboarding_completado?: boolean | null;
}

interface Params {
  role: AppRole | null | undefined;
  organization: OrganizationLike | null | undefined;
  pathname: string;
}

export function resolveProtectedRouteRedirect({
  role,
  organization,
  pathname,
}: Params): string | null {
  // Cliente accessing regular app routes → redirect to /portal
  if (role === "cliente" && !pathname.startsWith("/portal")) {
    return "/portal";
  }

  // Agente de carga accediendo a rutas internas → redirigir a /agente.
  // Defensa en profundidad: aunque el usuario tenga membresía admin/viewer
  // en alguna organización, su rol global `agente_carga` lo confina al portal.
  if (role === "agente_carga" && !pathname.startsWith("/agente")) {
    return "/agente";
  }

  // Super admin: permitirle operar módulos como cualquier admin_org. Sólo lo
  // enviamos a /admin cuando entra a la raíz `/` o `/dashboard` (aterrizaje por
  // defecto); si navega explícitamente a otra ruta operativa, respetamos su
  // intención. B-009 (v13.320.41): antes se le expulsaba de todo lo que no
  // empezara con /admin, inutilizando el OrgSwitcher.
  const isSuperAdmin = role === "super_admin";
  if (isSuperAdmin && (pathname === "/" || pathname === "/dashboard")) {
    return "/admin";
  }


  // Onboarding inicial: si la organización del usuario no ha completado los
  // datos básicos (RFC, dirección, moneda), forzar al admin a completarlos.
  if (
    organization &&
    organization.onboarding_completado === false &&
    role !== "cliente" &&
    !isSuperAdmin &&
    !pathname.startsWith("/onboarding")
  ) {
    return "/onboarding";
  }

  return null;
}
