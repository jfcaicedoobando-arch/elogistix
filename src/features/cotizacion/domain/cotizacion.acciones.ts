/**
 * Q-04 — Acciones permitidas en el detalle de cotización.
 * Extraído de `cotizacion.ts` (Power-of-10).
 *
 * v13.823.277 — las listas de roles son espejo de las reglas reales de la base
 * de datos, para no mostrar botones que la RPC rechaza con 42501:
 *  - enviar/rechazar → `public.puede_escribir_cotizaciones()` (`SALES`);
 *  - aceptar → `public.aceptar_cotizacion_version` (`ACEPTAR_COTIZACION`);
 *  - crear embarque → `public.crear_embarque_borrador_core`
 *    (`CREAR_EMBARQUE_BORRADOR`).
 */
import type { AppRole } from "@/types/appRole";
import {
  ACEPTAR_COTIZACION,
  CREAR_EMBARQUE_BORRADOR,
  SALES,
  hasRole,
} from "@/lib/access/permissionMatrix";

/** Estados de cotización relevantes para las acciones del detalle. */
export type EstadoCotizacionAccion = "Borrador" | "Solicitada" | "Enviada" | "Aceptada" | "Rechazada" | string;

export interface AccionesCotizacionPermitidas {
  exportarPdf: boolean;
  enviar: boolean;
  aceptar: boolean;
  rechazar: boolean;
  /** ¿El rol puede generar el embarque borrador? (espejo de la RPC). */
  crearEmbarque: boolean;
}

/**
 * Determina qué acciones del detalle de cotización deben mostrarse.
 * Pura y testeable: sin dependencias de React ni de Supabase.
 *
 * Reglas de negocio:
 *  - "Exportar PDF": siempre visible (no depende de estado, total ni rol).
 *  - "Enviar" / "Marcar enviada": sólo si el rol puede escribir cotizaciones,
 *    el estado es "Borrador" o "Solicitada" y el total es mayor a cero
 *    (evita enviar/aceptar cotizaciones vacías, p.ej. un borrador en $0.00).
 *  - "Aceptar" / "Rechazar": aceptar exige un rol autorizado por la RPC de
 *    aceptación; rechazar sólo escritura de cotizaciones. Ambos requieren
 *    total mayor a cero.
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
  /**
   * v13.624.0 — "cliente de casa": cuando el cliente NO requiere autorizar
   * cotizaciones, el equipo interno puede aceptarla/rechazarla desde
   * "Borrador" o "Solicitada" sin esperar la respuesta del cliente.
   */
  requiereAutorizacionCliente = true,
): AccionesCotizacionPermitidas {
  const puedeEscribir = hasRole(SALES, rol);
  const puedeAceptarRol = hasRole(ACEPTAR_COTIZACION, rol);
  const tieneTotal = Number(total) > 0;

  // Q-04b — Segregación de funciones: quien creó la cotización no puede
  // aceptarla él mismo (salvo administradores). Se OCULTA la acción, no se
  // deshabilita, para no ofrecer un botón que la base de datos rechazará.
  const esAutor =
    Boolean(sod.creadaPor) && Boolean(sod.usuarioActual) && sod.creadaPor === sod.usuarioActual;
  const exentoSoD = Boolean(rol) && ROLES_SOD_EXENTOS.includes(rol as AppRole);
  const bloqueadoPorSoD = esAutor && !exentoSoD;

  const enviar = puedeEscribir && tieneTotal && (estado === "Borrador" || estado === "Solicitada");
  const estadosAceptables = requiereAutorizacionCliente
    ? ["Enviada"]
    : ["Enviada", "Borrador", "Solicitada"];
  const enEstadoRespuesta = tieneTotal && estadosAceptables.includes(estado);

  return {
    exportarPdf: true,
    enviar,
    aceptar: enEstadoRespuesta && puedeAceptarRol && !bloqueadoPorSoD,
    rechazar: enEstadoRespuesta && puedeEscribir,
    crearEmbarque: hasRole(CREAR_EMBARQUE_BORRADOR, rol),
  };
}
