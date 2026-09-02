/**
 * Sprint 2 · ítem 6 — Home canónico del helper de bitácora.
 *
 * Escribe entradas en `bitacora_actividad` desde el frontend. Antes vivía en
 * `src/lib/domain/bitacora/registrar.ts`, pero `src/lib/**` debe permanecer
 * como capa pura (sin escrituras a BD). El módulo se mueve a
 * `src/services/bitacora/` — la implementación real está aquí; el path viejo
 * queda como re-export sólo por compatibilidad de imports históricos y se
 * migrarán los callers en olas subsecuentes.
 *
 * - Fire-and-forget: nunca lanza — la operación de negocio manda.
 * - Toma la sesión (`auth.getSession`) internamente para no repetirlo en cada caller.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Módulos válidos que puede registrar la bitácora (single source of truth). */
export const MODULOS_BITACORA = [
  { valor: "todos", etiqueta: "Todos los módulos" },
  { valor: "embarques", etiqueta: "Embarques" },
  { valor: "clientes", etiqueta: "Clientes" },
  { valor: "proveedores", etiqueta: "Proveedores" },
  { valor: "cotizaciones", etiqueta: "Cotizaciones" },
  { valor: "crm", etiqueta: "CRM" },
  { valor: "facturacion", etiqueta: "Facturación emitida" },
  { valor: "cxp", etiqueta: "Cuentas por pagar" },
  { valor: "tesoreria", etiqueta: "Tesorería y bancos" },
  { valor: "catalogos", etiqueta: "Catálogos" },
  { valor: "documentos", etiqueta: "Documentos y buzón" },
  { valor: "portal", etiqueta: "Portal de cliente" },
  { valor: "costeo", etiqueta: "Costeo y tarifas" },
  { valor: "auditoria", etiqueta: "Auditoría" },
  { valor: "usuarios", etiqueta: "Usuarios" },
  { valor: "configuracion", etiqueta: "Configuración" },
  { valor: "auth", etiqueta: "Autenticación" },
] as const;

export type ModuloBitacora = Exclude<
  (typeof MODULOS_BITACORA)[number]["valor"],
  "todos"
>;

export interface RegistrarActividadInput {
  modulo: ModuloBitacora;
  accion: string;
  entidadId?: string | null;
  entidadNombre?: string | null;
  detalles?: Record<string, unknown>;
}

/**
 * Registra una actividad en bitácora. Nunca lanza: en caso de error solo
 * emite `console.warn` para no romper el flujo de negocio.
 */
export async function registrarActividad(input: RegistrarActividadInput): Promise<void> {
  try {
    // Perf: `getSession()` lee la sesión ya cacheada en memoria/localStorage.
    // `getUser()` hacía un round-trip a /auth/v1/user en CADA registro, lo que
    // duplicaba la latencia de toda mutación del ERP.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // DEFECTO 8: la escritura directa a `bitacora_actividad` está REVOKE para
    // el cliente; sólo esta RPC (SECURITY DEFINER) puede insertar y deriva
    // usuario_id/email del servidor, nunca de lo que mande el navegador.
    const { error } = await supabase.rpc("registrar_bitacora", {
      p_modulo: input.modulo,
      p_accion: input.accion,
      p_entidad_id: input.entidadId ?? undefined,
      p_entidad_nombre: input.entidadNombre ?? "",
      p_detalles: (input.detalles ?? {}) as Json,
    });
    if (error) {
      console.warn("[bitacora] registrar falló:", error.message);
    }
  } catch (err) {
    console.warn("[bitacora] excepción:", err);
  }
}
