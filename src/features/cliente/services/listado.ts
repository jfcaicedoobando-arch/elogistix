import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

type Cliente = Tables<"clientes">;

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

interface ClienteListadoRow {
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

  const rows = (data ?? []) as ClienteListadoRow[];

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

  // Deduplicar por id (los RFC genéricos XAXX/XEXX se repiten legítimamente).
  return { data: dedupePorId(mapped), count };
}

function dedupePorId<T extends Pick<Cliente, "id">>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export async function fetchClientesForSelect(organizationId: string | null) {
  let query = supabase
    .from("clientes")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre");
  if (organizationId) query = query.eq("organization_id", organizationId);
  return unwrapOr(query, []);
}
