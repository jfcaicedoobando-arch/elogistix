/**
 * Q-04 — Acciones permitidas en el detalle de cotización.
 * Extraído de `cotizacion.ts` (Power-of-10).
 */
import type { AppRole } from "@/types/appRole";
import { FINANCE, OPERATIONS, SALES, hasRole } from "@/lib/access/permissionMatrix";

/** Estados de cotización relevantes para las acciones del detalle. */
export type EstadoCotizacionAccion = "Borrador" | "Solicitada" | "Enviada" | "Aceptada" | "Rechazada" | string;

export interface AccionesCotizacionPermitidas {
  exportarPdf: boolean;
  enviar: boolean;
  aceptar: boolean;
  rechazar: boolean;
}

/** ¿El rol puede editar/gestionar cotizaciones (capturar, enviar, aceptar, rechazar)? */
function puedeGestionarCotizacion(rol: AppRole | null | undefined): boolean {
  return hasRole(OPERATIONS, rol) || hasRole(FINANCE, rol) || hasRole(SALES, rol);
}

/**
 * Determina qué acciones del detalle de cotización deben mostrarse.
 * Pura y testeable: sin dependencias de React ni de Supabase.
 *
 * Reglas de negocio:
 *  - "Exportar PDF": siempre visible (no depende de estado, total ni rol).
 *  - "Enviar" / "Marcar enviada": sólo si el rol puede gestionar la cotización,
 *    el estado es "Borrador" o "Solicitada" y el total es mayor a cero
 *    (evita enviar/aceptar cotizaciones vacías, p.ej. un borrador en $0.00).
 *  - "Aceptar" / "Rechazar": sólo si el rol puede gestionar la cotización,
 *    el estado es "Enviada" y el total es mayor a cero.
 */
export interface ContextoSoDCotizacion {
  /** Usuario que creó la cotización. */
  creadaPor?: string | null;
  /** Usuario autenticado que está viendo el detalle. */
  usuarioActual?: string | null;
}

/** Roles que pueden saltarse la segregación de funciones (SoD). */
const ROLES_SOD_EXENTOS: AppRole[] = ["admin", "admin_org", "super_admin"];

export function accionesCotizacionPermitidas(
  estado: EstadoCotizacionAccion,
  total: number,
  rol: AppRole | null | undefined,
  sod: ContextoSoDCotizacion = {},
): AccionesCotizacionPermitidas {
  const puedeGestionar = puedeGestionarCotizacion(rol);
  const tieneTotal = Number(total) > 0;

  // Q-04b — Segregación de funciones: quien creó la cotización no puede
  // aceptarla él mismo (salvo administradores). Se OCULTA la acción, no se
  // deshabilita, para no ofrecer un botón que la base de datos rechazará.
  const esAutor =
    Boolean(sod.creadaPor) && Boolean(sod.usuarioActual) && sod.creadaPor === sod.usuarioActual;
  const exentoSoD = Boolean(rol) && ROLES_SOD_EXENTOS.includes(rol as AppRole);
  const bloqueadoPorSoD = esAutor && !exentoSoD;

  const enviar = puedeGestionar && tieneTotal && (estado === "Borrador" || estado === "Solicitada");
  const aceptarRechazar = puedeGestionar && tieneTotal && estado === "Enviada";

  return {
    exportarPdf: true,
    enviar,
    aceptar: aceptarRechazar && !bloqueadoPorSoD,
    rechazar: aceptarRechazar,
  };
}
