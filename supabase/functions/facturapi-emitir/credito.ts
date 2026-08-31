/**
 * M-15 (re-auditoría v15) — candado de límite de crédito del lado del servidor.
 *
 * Antes el límite sólo se validaba en el diálogo de la UI: cualquier camino que
 * no pasara por ese diálogo (timbrado desde otra pantalla, lote, reintento)
 * emitía factura aunque el cliente ya estuviera sobregirado. Aquí se valida
 * SIEMPRE, con override explícito para los roles de dirección/finanzas.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import { authorizeOrgRole } from "../_shared/auth.ts";
import { validarTcFiscal, esMonedaNacional } from "../_shared/tcBanda.ts";
import type { FacturaRow } from "./types.ts";

let adminSingleton: SupabaseClient | null = null;
/**
 * `credito_en_uso_mxn` está REVOKE FROM authenticated y GRANT sólo a
 * service_role. El cliente del handler lleva el JWT del usuario en
 * `Authorization`, así que PostgREST lo ejecuta como `authenticated` y la RPC
 * devolvía permission denied → 503 credito_no_verificable siempre. Igual que
 * en `_shared/facturapiAuth.ts`, usamos un cliente admin sin ese header.
 * En tests no hay env vars → devolvemos null y se usa el cliente inyectado.
 */
function getAdminClient(): SupabaseClient | null {
  if (adminSingleton) return adminSingleton;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  adminSingleton = createClient(url, key, { auth: { persistSession: false } });
  return adminSingleton;
}

/**
 * Roles que pueden emitir por arriba del límite de crédito. Espejo de
 * `ROLES_OVERRIDE_CREDITO` en
 * `src/features/cliente/hooks/useValidarLimiteCredito.ts`. Mantener sincronizada.
 */
export const ROLES_OVERRIDE_CREDITO: readonly string[] = [
  "super_admin", "admin", "admin_org", "contador", "tesorero",
  "gerente_operaciones", "gerente_comercial",
];

function totalEnMxn(factura: FacturaRow): number {
  const total = Number(factura.total ?? 0);
  if (esMonedaNacional(factura.moneda)) return total;
  return total * Number(factura.tipo_cambio);
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
  // Ola 3 · A — fail-closed real: si la lectura del cliente falla no se puede
  // saber si hay límite, así que NO se timbra (antes se continuaba al PAC).
  if (error) {
    console.error("credito_cliente_read_failed", { clienteId: factura.cliente_id, code: error.code });
    return jsonResponse({
      error: "credito_no_verificable",
      message: "No se pudo verificar el límite de crédito del cliente. Intenta de nuevo en unos segundos.",
    }, 503);
  }
  // Cliente inexistente = dato roto, no "sin límite" (convención de la familia
  // NC: 404 cliente_not_found).
  if (!cliente) {
    return jsonResponse({
      error: "cliente_not_found",
      message: "El cliente de la factura no existe o fue eliminado. Revisa la factura antes de timbrar.",
    }, 404);
  }
  // 0/NULL = sin límite configurado (mismo criterio que la UI).
  const limite = Number(cliente.limite_credito_mxn ?? 0);
  if (!(limite > 0)) return null;


  // YG-01: un TC inválido para moneda != MXN subestimaba el límite de crédito
  // (fallback de factor 1). Fail-closed: no se puede calcular la exposición
  // real, así que no se timbra.
  if (!esMonedaNacional(factura.moneda)) {
    const mensajeTc = validarTcFiscal(factura.moneda, factura.tipo_cambio);
    if (mensajeTc) {
      return jsonResponse({
        error: "credito_no_verificable",
        message: `No se pudo verificar el límite de crédito del cliente: ${mensajeTc}`,
      }, 503);
    }
  }

  const rpcClient = getAdminClient() ?? supabase;
  const { data: enUso, error: errUso } = await rpcClient.rpc("credito_en_uso_mxn", {
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
