/**
 * Variantes de la pantalla `/sin-acceso` (RG1 / UIA-04 / Frente 1).
 *
 * - `sin-rol-org`: el usuario está autenticado pero no tiene rol ni
 *   organización asignada todavía.
 * - `permiso-modulo`: el usuario tiene un rol válido, pero ese rol no
 *   alcanza para el módulo al que intentó entrar.
 * - `error-carga`: no se pudo resolver el perfil/rol por una falla técnica
 *   (red, backend); no es un problema de permisos, sino de disponibilidad.
 *
 * Extraído como función pura para poder probarla sin montar React ni router.
 */
import type { AppRole } from "@/types/appRole";

export type SinAccesoVariant = "sin-rol-org" | "permiso-modulo" | "error-carga";

const MOTIVOS_VALIDOS: readonly string[] = ["sin-rol-org", "permiso-modulo", "error-carga"];

interface ResolveSinAccesoVariantParams {
  motivo?: string | null;
  effectiveRole?: AppRole | null;
}

/**
 * Resuelve la variante a mostrar. `error-carga` tiene prioridad porque es un
 * problema técnico, no de permisos, independientemente de si hay rol
 * resuelto (puede haber uno "viejo" en caché mientras falla el refresh).
 */
export function resolveSinAccesoVariant({
  motivo,
  effectiveRole,
}: ResolveSinAccesoVariantParams): SinAccesoVariant {
  if (motivo === "error-carga") return "error-carga";
  if (motivo === "permiso-modulo" && Boolean(effectiveRole)) return "permiso-modulo";
  if (motivo && MOTIVOS_VALIDOS.includes(motivo) && motivo !== "sin-rol-org") {
    // motivo reconocido pero sin las condiciones extra (p. ej. permiso-modulo sin rol)
    return "sin-rol-org";
  }
  return "sin-rol-org";
}

/** Roles con capacidad administrativa (pueden dar de alta a otros usuarios). */
export function esRolAdministrador(role: AppRole | null | undefined): boolean {
  return role === "admin_org" || role === "super_admin";
}
