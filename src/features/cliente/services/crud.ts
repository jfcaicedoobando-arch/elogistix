import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

import {
  clienteInsertSchema,
  clienteUpdateSchema,
  parseOrThrow,
} from "@/lib/validation/mutationSchemas";

export type Cliente = Tables<"clientes">;


export const CLIENTE_DETAIL_COLUMNS =
  "id, nombre, rfc, direccion, ciudad, estado, cp, contacto, telefono, email, regimen_fiscal, uso_cfdi_default, dias_credito, limite_credito_mxn, organization_id, created_at, updated_at" as const;


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

// ============================================================
// Exposición de crédito (fuente única de verdad)
// ============================================================

export interface ExposicionCreditoCliente {
  clienteId: string;
  organizationId: string | null;
  diasCredito: number | null;
  limiteMxn: number | null;
  enUsoMxn: number;
  disponibleMxn: number | null;
  excedido: boolean;
  facturasVivas: number;
}

/** Exposición de crédito consolidada del cliente (RPC `get_exposicion_credito_cliente`). */
export async function fetchExposicionCreditoCliente(
  clienteId: string,
): Promise<ExposicionCreditoCliente | null> {
  const { data, error } = await supabase.rpc("get_exposicion_credito_cliente", {
    p_cliente_id: clienteId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    clienteId: row.cliente_id,
    organizationId: row.organization_id ?? null,
    diasCredito: row.dias_credito ?? null,
    limiteMxn: row.limite_mxn == null ? null : Number(row.limite_mxn),
    enUsoMxn: Number(row.en_uso_mxn ?? 0),
    disponibleMxn: row.disponible_mxn == null ? null : Number(row.disponible_mxn),
    excedido: Boolean(row.excedido),
    facturasVivas: Number(row.facturas_vivas ?? 0),
  };
}

// ============================================================
// CRUD Cliente
// ============================================================

export async function createCliente(cliente: TablesInsert<"clientes">) {
  parseOrThrow(clienteInsertSchema, cliente, "Cliente");
  return unwrap(
    supabase.from("clientes").insert(cliente).select().single(),
  );
}

export async function updateCliente(
  id: string,
  updates: Partial<Cliente>,
): Promise<Cliente> {
  parseOrThrow(clienteUpdateSchema, updates, "Cliente");
  return unwrap(
    supabase.from("clientes").update(updates).eq("id", id).select().single(),
  );
}

