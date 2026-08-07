import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { registrarActividad } from "@/services/bitacora/registrar";

import {
  clienteInsertSchema,
  clienteUpdateSchema,
  parseOrThrow,
} from "@/lib/validation/mutationSchemas";

export type Cliente = Tables<"clientes">;


export const CLIENTE_DETAIL_COLUMNS =
  "id, nombre, rfc, direccion, ciudad, estado, cp, contacto, telefono, email, regimen_fiscal, uso_cfdi_default, dias_credito, limite_credito_mxn, sin_comision, organization_id, created_at, updated_at" as const;


// ============================================================
// Listados / búsqueda
// ============================================================

export interface FetchClientesPaginadosParams {
  search: string;
  page: number;
  pageSize: number;
  organizationId: string | null;
}

export interface ClienteListItem {
  id: string;
  nombre: string;
  rfc: string;
  ciudad: string;
  estado: string;
  contacto: string;
  telefono: string;
  email: string;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
  saldo_pendiente_mxn: number;
  total_embarques: number;
  total_cotizaciones: number;
  deuda_pendiente: number;
}

export async function fetchClientesPaginados({
  search,
  page,
  pageSize,
  organizationId,
}: FetchClientesPaginadosParams): Promise<{ data: ClienteListItem[]; count: number }> {
  // Bloque 2.4 — RPC `clientes_listado` con agregados (embarques, cotizaciones, deuda)
  // para eliminar N+1 desde la UI.
  const offset = page * pageSize;
  const data = await unwrap(
    supabase.rpc("clientes_listado", {
      p_organization_id: organizationId ?? undefined,
      p_search: search || undefined,
      p_offset: offset,
      p_limit: pageSize,
    }),
  );



  const rows = (data ?? []) as Array<{
    id: string;
    nombre: string;
    rfc: string | null;
    ciudad: string | null;
    estado: string | null;
    contacto: string | null;
    telefono: string | null;
    email: string | null;
    dias_credito: number | null;
    limite_credito_mxn: number | string | null;
    saldo_pendiente_mxn: number | string | null;
    total_embarques: number | string;
    total_cotizaciones: number | string;
    deuda_pendiente: number | string;
    total_count: number | string;
  }>;

  const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const mapped: ClienteListItem[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    rfc: r.rfc ?? "",
    ciudad: r.ciudad ?? "",
    estado: r.estado ?? "",
    contacto: r.contacto ?? "",
    telefono: r.telefono ?? "",
    email: r.email ?? "",
    dias_credito: r.dias_credito,
    limite_credito_mxn: r.limite_credito_mxn == null ? null : Number(r.limite_credito_mxn),
    saldo_pendiente_mxn: Number(r.saldo_pendiente_mxn ?? 0),
    total_embarques: Number(r.total_embarques),
    total_cotizaciones: Number(r.total_cotizaciones),
    deuda_pendiente: Number(r.deuda_pendiente),
  }));

  // Deduplicar por RFC (compat histórica con duplicados en BD).
  return { data: dedupeByRfc(mapped), count };
}


function dedupeByRfc<T extends Pick<Cliente, "id" | "rfc">>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((c) => {
    const key = (c.rfc ?? "").trim().toUpperCase() || `__id:${c.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchClientesForSelect(organizationId: string | null) {
  let query = supabase
    .from("clientes")
    .select("id, nombre")
    .order("nombre");
  if (organizationId) query = query.eq("organization_id", organizationId);
  return unwrapOr(query, []);
}

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
  const creado = (await unwrap(
    supabase.from("clientes").insert(payload).select().single(),
  )) as Cliente;
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
): Promise<Cliente> {
  parseOrThrow(clienteUpdateSchema, updates, "Cliente");
  const payload =
    updates.nombre === undefined
      ? updates
      : { ...updates, nombre: normalizarRazonSocial(updates.nombre) };
  const actualizado = (await unwrap(
    supabase.from("clientes").update(payload).eq("id", id).select().single(),
  )) as Cliente;
  await registrarActividad({
    modulo: "clientes",
    accion: "editar",
    entidadId: id,
    entidadNombre: actualizado.nombre,
    detalles: { campos: Object.keys(payload) },
  });
  return actualizado;
}

