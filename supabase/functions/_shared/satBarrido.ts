/**
 * Ola 2 · O2.11.2 — Núcleo compartido del barrido de estatus de CFDI ante el
 * SAT. Extraído de `verificar-sat-lote` para reutilizarlo en el barrido
 * semanal de plataforma (`verificar-sat-semanal`) sin duplicar la lógica.
 *
 * Sólo actualiza `uuid_verificado`, `uuid_estatus_sat` y
 * `uuid_verificado_fecha`. Nunca cambia el estado ni los importes de la
 * factura.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { consultarSat, normalizarRfc, type EstatusSat } from "./satConsulta.ts";

export const PAUSA_MS = 350;
// EF-05: con 200/500 el lote no cabe en el wall-clock de la edge (~150 s).
export const LIMITE_DEFAULT = 50;
export const LIMITE_MAX = 50;

export interface FilaFactura {
  id: string;
  uuid_fiscal: string | null;
  rfc_proveedor: string | null;
  total: number | null;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  estado: string | null;
}

export interface Cancelada {
  id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  total: number | null;
  uuid_fiscal: string | null;
}

export type Resumen = Record<EstatusSat | "omitidas", number>;

export const resumenVacio = (): Resumen => ({
  Vigente: 0,
  Cancelado: 0,
  "No Encontrado": 0,
  "No verificable": 0,
  Error: 0,
  omitidas: 0,
});

export interface Salida {
  total: number;
  procesadas: number;
  resumen: Resumen;
  canceladas: Cancelada[];
  fallos: { id: string; motivo: string }[];
}

export const salidaVacia = (): Salida => ({
  total: 0,
  procesadas: 0,
  resumen: resumenVacio(),
  canceladas: [],
  fallos: [],
});

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function parseLimite(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return LIMITE_DEFAULT;
  return Math.min(Math.floor(n), LIMITE_MAX);
}

export async function rfcOrganizacion(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data } = await admin.from("organizations").select("rfc").eq("id", orgId).maybeSingle();
  return normalizarRfc((data as { rfc?: string } | null)?.rfc);
}

export async function cargarFacturas(
  admin: SupabaseClient,
  orgId: string,
  soloSinVerificar: boolean,
  limite: number,
): Promise<FilaFactura[]> {
  let q = admin
    .from("proveedor_facturas")
    .select(
      "id, uuid_fiscal, rfc_proveedor, total, folio_interno, folio_proveedor, proveedor_nombre, estado, proveedores!inner(origen_proveedor)",
    )
    .eq("organization_id", orgId)
    .not("uuid_fiscal", "is", null)
    .neq("proveedores.origen_proveedor", "Extranjero")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (soloSinVerificar) q = q.is("uuid_estatus_sat", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FilaFactura[];
}

/**
 * Variante del barrido semanal: prioriza las facturas nunca verificadas y las
 * verificadas hace más tiempo (round-robin natural entre corridas).
 */
export async function cargarFacturasPorAntiguedadVerificacion(
  admin: SupabaseClient,
  orgId: string,
  limite: number,
): Promise<FilaFactura[]> {
  const { data, error } = await admin
    .from("proveedor_facturas")
    .select(
      "id, uuid_fiscal, rfc_proveedor, total, folio_interno, folio_proveedor, proveedor_nombre, estado, uuid_verificado_fecha, proveedores!inner(origen_proveedor)",
    )
    .eq("organization_id", orgId)
    .not("uuid_fiscal", "is", null)
    .neq("proveedores.origen_proveedor", "Extranjero")
    .in("estado", ["Vigente", "Pagada"])
    .order("uuid_verificado_fecha", { ascending: true, nullsFirst: true })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FilaFactura[];
}

/**
 * R3 · P2 — Patch de persistencia del barrido SAT. `uuid_verificado` sólo
 * cambia con un VEREDICTO definitivo del SAT (Vigente/Cancelado/No
 * Encontrado). Un estatus transitorio (`Error`: SAT caído/timeout; `No
 * verificable`: expresión rechazada) es indeterminado y NO debe revertir en
 * masa banderas legítimas durante un outage — se registra el estatus y la
 * fecha para reintentar en la siguiente corrida, conservando el valor previo.
 * Extraída como función pura para testearla sin red.
 */
export function patchVerificacionSat(
  estatus: EstatusSat,
  fechaIso: string,
): { uuid_verificado?: boolean; uuid_estatus_sat: EstatusSat; uuid_verificado_fecha: string } {
  const esVeredictoDefinitivo =
    estatus === "Vigente" || estatus === "Cancelado" || estatus === "No Encontrado";
  return {
    ...(esVeredictoDefinitivo ? { uuid_verificado: estatus === "Vigente" } : {}),
    uuid_estatus_sat: estatus,
    uuid_verificado_fecha: fechaIso,
  };
}

export async function procesarFactura(
  admin: SupabaseClient,
  f: FilaFactura,
  rfcReceptor: string,
  out: Salida,
): Promise<void> {
  const rfcEmisor = normalizarRfc(f.rfc_proveedor);
  const uuid = (f.uuid_fiscal ?? "").trim().toUpperCase();
  if (!rfcEmisor || !uuid) {
    out.resumen.omitidas += 1;
    out.fallos.push({ id: f.id, motivo: "Falta RFC del proveedor o UUID" });
    return;
  }

  const res = await consultarSat(rfcEmisor, rfcReceptor, Number(f.total ?? 0), uuid);
  out.resumen[res.estatus] += 1;
  out.procesadas += 1;

  if (res.estatus === "Cancelado") {
    out.canceladas.push({
      id: f.id,
      folio_interno: f.folio_interno,
      folio_proveedor: f.folio_proveedor,
      proveedor_nombre: f.proveedor_nombre,
      total: f.total,
      uuid_fiscal: f.uuid_fiscal,
    });
  }

  const { error } = await admin
    .from("proveedor_facturas")
    .update(patchVerificacionSat(res.estatus, new Date().toISOString()))
    .eq("id", f.id);
  if (error) out.fallos.push({ id: f.id, motivo: `No se pudo guardar: ${error.message}` });
}

/** Barre una organización completa y devuelve su resumen. */
export async function barrerOrganizacion(
  admin: SupabaseClient,
  orgId: string,
  facturas: FilaFactura[],
  rfcReceptor: string,
): Promise<Salida> {
  const out = salidaVacia();
  out.total = facturas.length;
  for (const f of facturas) {
    try {
      await procesarFactura(admin, f, rfcReceptor, out);
    } catch (e) {
      out.fallos.push({ id: f.id, motivo: (e as Error).message });
      out.resumen.Error += 1;
    }
    await dormir(PAUSA_MS);
  }
  return out;
}
