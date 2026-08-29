/**
 * M-15 (re-auditoría v15) — candado de límite de crédito del lado del servidor.
 *
 * Antes el límite sólo se validaba en el diálogo de la UI: cualquier camino que
 * no pasara por ese diálogo (timbrado desde otra pantalla, lote, reintento)
 * emitía factura aunque el cliente ya estuviera sobregirado. Aquí se valida
 * SIEMPRE, con override explícito para los roles de dirección/finanzas.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import { authorizeOrgRole } from "../_shared/auth.ts";
import type { FacturaRow } from "./types.ts";

/**
 * Roles que pueden emitir por arriba del límite de crédito. Espejo de
 * `ROLES_OVERRIDE_CREDITO` en
 * `src/features/cliente/hooks/useValidarLimiteCredito.ts`. Mantener sincronizada.
 */
export const ROLES_OVERRIDE_CREDITO: readonly string[] = [
  "super_admin", "admin", "admin_org", "contador", "tesorero",
  "gerente_operaciones", "gerente_comercial",
];

const MXN_POR_DEFECTO = 1;

function totalEnMxn(factura: FacturaRow): number {
  const total = Number(factura.total ?? 0);
  if ((factura.moneda ?? "MXN") === "MXN") return total;
  const tc = Number(factura.tipo_cambio ?? 0);
  return total * (tc > 1 ? tc : MXN_POR_DEFECTO);
}

/**
 * Devuelve una respuesta 409 cuando la factura rebasa el límite de crédito del
 * cliente y quien timbra no tiene rol de override. `null` = puede continuar.
 */
export async function validarLimiteCredito(
  supabase: SupabaseClient,
  factura: FacturaRow,
  userId: string,
): Promise<Response | null> {
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("nombre, limite_credito_mxn")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  // Sin cliente o sin límite configurado no hay nada que validar (0/NULL = sin
  // límite, como hoy en la UI).
  if (error || !cliente) return null;
  const limite = Number(cliente.limite_credito_mxn ?? 0);
  if (!(limite > 0)) return null;

  const { data: enUso, error: errUso } = await supabase.rpc("credito_en_uso_mxn", {
    p_cliente_id: factura.cliente_id,
  });
  // M-15: fail-closed. Si no se puede calcular la exposición, no se timbra.
  if (errUso) {
    return jsonResponse({
      error: "credito_no_verificable",
      message: "No se pudo verificar el límite de crédito del cliente. Intenta de nuevo en unos segundos.",
    }, 503);
  }

  const proyectado = Number(enUso ?? 0) + totalEnMxn(factura);
  if (proyectado <= limite) return null;

  const puedeExcederlo = await authorizeOrgRole(
    supabase, userId, factura.organization_id, ROLES_OVERRIDE_CREDITO,
  );
  if (puedeExcederlo) return null;

  return jsonResponse({
    error: "credito_excedido",
    message: `Con esta factura el cliente ${cliente.nombre} llegaría a $${proyectado.toFixed(2)} MXN de saldo a crédito y su límite es de $${limite.toFixed(2)} MXN. Pide autorización a dirección o finanzas.`,
  }, 409);
}

/**
 * B-11 — una factura en $0 no es timbrable: el SAT la rechaza y en la práctica
 * siempre es captura incompleta.
 */
export function validarTotalPositivo(factura: FacturaRow): Response | null {
  if (Number(factura.total ?? 0) > 0) return null;
  return jsonResponse({
    error: "total_cero",
    message: "La factura tiene un total de $0. Revisa los conceptos antes de timbrar.",
  }, 422);
}
