/**
 * Helper único para registrar entradas en `bitacora_actividad` desde el frontend.
 *
 * - Fuente única de verdad para los valores de `modulo` (kebab lowercase).
 * - Fire-and-forget: nunca lanza — la operación de negocio manda.
 * - Toma `auth.getUser` internamente para no repetirlo en cada caller.
 *
 * Uso:
 * ```ts
 * await registrarActividad({
 *   modulo: "cxp",
 *   accion: "crear",
 *   entidadId: facturaId,
 *   entidadNombre: `FP-${folioInterno}`,
 *   detalles: { proveedor_nombre, total, moneda },
 * });
 * ```
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("bitacora_actividad").insert({
      usuario_id: user.id,
      usuario_email: user.email ?? "",
      accion: input.accion,
      modulo: input.modulo,
      entidad_id: input.entidadId ?? null,
      entidad_nombre: input.entidadNombre ?? "",
      detalles: (input.detalles ?? {}) as Json,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[bitacora] registrar falló:", error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bitacora] excepción:", err);
  }
}
