/**
 * Máquina de estados de las notas de crédito de cliente (CxC).
 *
 * Extraído de `notasCredito.ts` (v13.823.x) para cumplir el límite de 200
 * líneas por archivo: aquí vive SÓLO la transición de estado y su bloqueo
 * optimista; el CRUD sigue en `notasCredito.ts`.
 *
 * Máquina canónica (espejo EXACTO de public.guard_nc_cliente_transicion,
 * FIX2 ronda 2):
 *   Borrador  → {Timbrada, Cancelada}
 *   Timbrada  → {Aplicada, Cancelada}
 *   Aplicada  → {Cancelada}
 *   Aprobada  → {Timbrada, Cancelada}  (legado, sólo salida)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getCurrentUser } from "@/features/auth/services";
import { unwrapOr } from "@/lib/supabase/response";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import { registrarActividad } from "@/services/bitacora/registrar";

type NotaCredito = Tables<"factura_notas_credito">;
export type EstadoNotaCredito = NotaCredito["estado"];

const TRANSICIONES: Record<EstadoNotaCredito, EstadoNotaCredito[]> = {
  Borrador: ["Timbrada", "Cancelada"],
  Aprobada: ["Timbrada", "Cancelada"],
  Timbrada: ["Aplicada", "Cancelada"],
  Aplicada: ["Cancelada"],
  Cancelada: [],
};

function asegurarTransicion(actual: EstadoNotaCredito, siguiente: EstadoNotaCredito): void {
  if (!TRANSICIONES[actual].includes(siguiente)) {
    throw new Error(`Transición inválida: ${actual} → ${siguiente}`);
  }
}

export async function cambiarEstadoNotaCredito(
  id: string,
  estadoActual: EstadoNotaCredito,
  estadoNuevo: EstadoNotaCredito,
  /**
   * N-06 (QA r2): bloqueo optimista. Junto con el filtro por `estado` garantiza
   * que la NC sigue exactamente como estaba cuando se validó la transición.
   */
  expectedUpdatedAt?: string | null,
): Promise<void> {
  asegurarTransicion(estadoActual, estadoNuevo);
  const patch: Partial<NotaCredito> = { estado: estadoNuevo };
  if (estadoNuevo === "Aprobada") {
    const user = await getCurrentUser();
    patch.aprobada_por = user.id;
    patch.aprobada_at = new Date().toISOString();
  }
  let query = supabase
    .from("factura_notas_credito")
    .update(patch)
    .eq("id", id)
    .eq("estado", estadoActual);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const filas = await unwrapOr(query.select("id"), []);
  if (filas.length === 0) throw conflictoConcurrenciaError();
  await registrarActividad({
    modulo: "facturacion",
    accion: `Cambió estado de nota de crédito a ${estadoNuevo}`,
    entidadId: id,
    detalles: { estado_anterior: estadoActual, estado_nuevo: estadoNuevo },
  });
}
