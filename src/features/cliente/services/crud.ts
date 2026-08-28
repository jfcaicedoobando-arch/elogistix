import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { unwrap } from "@/lib/supabase/response";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { registrarActividad } from "@/services/bitacora/registrar";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";

import {
  clienteInsertSchema,
  clienteUpdateSchema,
  parseOrThrow,
} from "@/lib/validation/mutationSchemas";

export type Cliente = Tables<"clientes">;


export const CLIENTE_DETAIL_COLUMNS =
  "id, nombre, rfc, direccion, ciudad, estado, cp, contacto, telefono, email, regimen_fiscal, uso_cfdi_default, dias_credito, limite_credito_mxn, sin_comision, requiere_autorizacion_cotizacion, requiere_autorizacion_proforma, organization_id, created_at, updated_at" as const;


// Listados / búsqueda: viven en `./listado.ts`; re-export por compat.
export {
  fetchClientesPaginados,
  fetchClientesForSelect,
  type FetchClientesPaginadosParams,
  type ClienteListItem,
} from "./listado";

// ============================================================
// Detalle
// ============================================================

export async function fetchCliente(id: string) {
  return unwrap(
    supabase.from("clientes").select(CLIENTE_DETAIL_COLUMNS).eq("id", id).single(),
  );
}

/** Días de crédito por defecto del cliente (para precargar el diálogo de proforma). */
export async function fetchDiasCreditoCliente(
  clienteId: string,
): Promise<number | null> {
  const data = await unwrap(
    supabase
      .from("clientes")
      .select("dias_credito")
      .eq("id", clienteId)
      .maybeSingle(),
  );
  return data?.dias_credito ?? null;
}

// Exposición de crédito: vive en `./exposicionCredito.ts`; re-export por compat.
export {
  fetchExposicionCreditoCliente,
  type ExposicionCreditoCliente,
} from "./exposicionCredito";

// ============================================================
// CRUD Cliente
// ============================================================

export async function createCliente(cliente: TablesInsert<"clientes">) {
  parseOrThrow(clienteInsertSchema, cliente, "Cliente");
  const payload = { ...cliente, nombre: normalizarRazonSocial(cliente.nombre) };
  // M4 (auditoría 3-3): el alta va por la RPC canónica `crear_clientes`, que
  // valida la completitud fiscal cuando el cliente lleva RFC. El INSERT
  // directo a la tabla ya no está permitido para usuarios de la app.
  const filas = (await unwrap(
    // SAFE-CAST: el payload ya pasó `clienteInsertSchema`; la RPC recibe jsonb.
    supabase.rpc("crear_clientes", { p_clientes: [payload] as unknown as Json }),
  )) as Cliente[] | null;
  const creado = filas?.[0];
  if (!creado) throw new Error("No se pudo dar de alta el cliente.");
  await registrarActividad({
    modulo: "clientes",
    accion: "crear",
    entidadId: creado.id,
    entidadNombre: creado.nombre,
    detalles: { rfc: creado.rfc, dias_credito: creado.dias_credito },
  });
  return creado;
}

export async function updateCliente(
  id: string,
  updates: Partial<Cliente>,
  /**
   * N-06 (QA r2): bloqueo optimista. `updated_at` leído al abrir el
   * formulario; si la fila ya cambió, el UPDATE no toca ninguna fila y se
   * lanza LC_CONFLICTO_CONCURRENCIA en vez de sobrescribir cambios ajenos.
   */
  expectedUpdatedAt?: string | null,
): Promise<Cliente> {
  parseOrThrow(clienteUpdateSchema, updates, "Cliente");
  const payload =
    updates.nombre === undefined
      ? updates
      : { ...updates, nombre: normalizarRazonSocial(updates.nombre) };
  let query = supabase.from("clientes").update(payload).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const rows = (await unwrap(query.select())) as Cliente[] | null;
  if (!rows || rows.length === 0) {
    if (expectedUpdatedAt) throw conflictoConcurrenciaError();
    throw new Error("No se guardaron los cambios del cliente: no tienes permiso o el cliente ya no existe.");
  }
  const actualizado = rows[0];
  await registrarActividad({
    modulo: "clientes",
    accion: "editar",
    entidadId: id,
    entidadNombre: actualizado.nombre,
    detalles: { campos: Object.keys(payload) },
  });
  return actualizado;
}

