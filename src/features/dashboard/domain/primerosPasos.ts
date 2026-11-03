import type { AppRole } from "@/types/appRole";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import { resolveDestinoPorPagar } from "../finance/destinoPorPagar";
import {
  crearTareaPlataforma, crearTareaPortal, crearTareasOrganizacion,
  type PermisosPrimerosPasos, type TareaPrimerosPasos,
} from "./primerosPasosTareas";

export type { PermisosPrimerosPasos, TareaPrimerosPasos } from "./primerosPasosTareas";

export interface ContextoPrimerosPasos {
  userId: string | null;
  role: AppRole | null;
  effectiveRole: AppRole | null;
  organizationId: string | null;
  loading: boolean;
  profileError: boolean;
  errorOrganizaciones: boolean;
  permisos: PermisosPrimerosPasos;
  /** Menú del ERP resuelto sin queries; portales globales conservan su entrada propia. */
  esRutaVisible: (pathname: string) => boolean;
}

export interface ResultadoPrimerosPasos {
  estado: "cargando" | "sin-sesion" | "error-perfil" | "error-organizaciones" | "sin-rol" | "sin-organizacion" | "disponible";
  contexto: "organizacion" | "plataforma" | "portal-cliente" | "portal-agente" | null;
  tareas: readonly TareaPrimerosPasos[];
}

const pathname = (href: string) => href.split("?")[0];
const vacio = (estado: ResultadoPrimerosPasos["estado"]): ResultadoPrimerosPasos => ({ estado, contexto: null, tareas: [] });

/** Selecciona orientación y navegación; no representa avance ni autoriza acciones. */
export function seleccionarPrimerosPasos(c: ContextoPrimerosPasos): ResultadoPrimerosPasos {
  if (c.loading) return vacio("cargando");
  if (!c.userId) return vacio("sin-sesion");
  if (c.profileError) return vacio("error-perfil");
  // Los portales se autorizan por rol global y no por la matriz del ERP interno.
  if (c.role === "cliente" || c.role === "agente_carga") {
    return {
      estado: "disponible", contexto: c.role === "cliente" ? "portal-cliente" : "portal-agente",
      tareas: [crearTareaPortal(c.role)],
    };
  }
  if (c.errorOrganizaciones) return vacio("error-organizaciones");
  if (!c.effectiveRole) return vacio("sin-rol");
  // El contexto real ignora super_admin otorgado sólo mediante membresía.
  if (c.effectiveRole === "super_admin" && c.role !== "super_admin") return vacio("sin-rol");
  const visible = (href: string) => hasRouteAccess(c.effectiveRole, pathname(href))
    && c.esRutaVisible(pathname(href));
  const plataforma = c.role === "super_admin" && visible("/admin") ? [crearTareaPlataforma()] : [];
  if (!c.organizationId) {
    return c.role === "super_admin"
      ? { estado: "disponible", contexto: "plataforma", tareas: plataforma }
      : vacio("sin-organizacion");
  }
  const destino = [resolveDestinoPorPagar(c.effectiveRole), "/compras/facturas", "/compras"]
    .find((href) => href !== undefined && visible(href));
  return {
    estado: "disponible", contexto: "organizacion",
    tareas: [...crearTareasOrganizacion(c.permisos, visible, destino), ...plataforma],
  };
}
