/**
 * Bloque R — Seguros de carga por embarque.
 * CRUD contra `public.seguros_embarque`. RLS aísla por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { run, unwrap, unwrapOr } from "@/lib/supabase/response";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";
import type { Moneda } from "@/types/db";
import { z } from "zod";
import { normalizarPrimaSeguro, SEGURO_FACTURA_SELECTOR_ENABLED, SEGURO_FACTURA_SELECTOR_ERROR } from "../domain/seguroFacturaSelector";

export type MonedaSeguro = Moneda;

export interface SeguroEmbarque {
  id: string;
  embarque_id: string;
  organization_id: string;
  aseguradora: string;
  numero_poliza: string;
  certificado_url: string | null;
  cobertura_descripcion: string | null;
  suma_asegurada: number;
  deducible: number;
  prima: number;
  moneda: MonedaSeguro;
  vigencia_desde: string;
  vigencia_hasta: string;
  contacto: string | null;
  notas: string | null;
  /** Factura de proveedor que documenta la prima (hallazgo 148). Opcional. */
  proveedor_factura_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SeguroEmbarqueInput = Omit<
  SeguroEmbarque,
  "id" | "created_at" | "updated_at" | "organization_id"
> & { organization_id?: string };

const COLUMNS =
  "id, embarque_id, organization_id, aseguradora, numero_poliza, certificado_url, cobertura_descripcion, suma_asegurada, deducible, prima, moneda, vigencia_desde, vigencia_hasta, contacto, notas, proveedor_factura_id, created_at, updated_at";

const facturaSeguroSchema = z.object({
  id: z.string().uuid(),
  folio_interno: z.string().nullable(),
  proveedor_nombre: z.string().nullable(),
  subtotal: z.string().regex(/^-?\d+(?:\.\d+)?$/),
  moneda: z.string(),
}).strict();
const facturaSeguroCursorSchema = z.object({
  fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  id: z.string().uuid(),
}).strict();
const facturasSeguroPageSchema = z.object({
  items: z.array(facturaSeguroSchema),
  next_cursor: facturaSeguroCursorSchema.nullable(),
}).strict();

export type FacturaSeguroElegible = z.infer<typeof facturaSeguroSchema>;
export type FacturasSeguroCursor = z.infer<typeof facturaSeguroCursorSchema>;
export type FacturasSeguroPage = z.infer<typeof facturasSeguroPageSchema>;
export interface FacturasSeguroRequest {
  embarqueId: string;
  prima: number | string;
  moneda: MonedaSeguro;
  seguroId?: string | null;
  cursor?: FacturasSeguroCursor | null;
  limit?: number;
}

function selectorRpcArgs(input: FacturasSeguroRequest) {
  const prima = normalizarPrimaSeguro(input.prima);
  const limit = input.limit ?? 25;
  if (!SEGURO_FACTURA_SELECTOR_ENABLED || prima === null ||
      !["MXN", "USD", "EUR"].includes(input.moneda) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error();
  return {
    p_embarque_id: input.embarqueId,
    p_prima: prima,
    p_moneda: input.moneda,
    p_seguro_id: input.seguroId ?? null,
    p_limit: limit,
    p_cursor_fecha: input.cursor?.fecha_emision ?? null,
    p_cursor_id: input.cursor?.id ?? null,
  };
}

function parseSelectorPage(data: unknown, limit: number, previous?: FacturasSeguroCursor | null): FacturasSeguroPage {
  const page = facturasSeguroPageSchema.parse(data);
  const cursor = page.next_cursor;
  if (page.items.length > limit || new Set(page.items.map((item) => item.id)).size !== page.items.length ||
      (cursor && (cursor.id !== page.items.at(-1)?.id ||
        (cursor.id === previous?.id && cursor.fecha_emision === previous.fecha_emision)))) {
    throw new Error();
  }
  return page;
}

/** Narrow, server-authoritative contract. No table-query fallback or financial arithmetic. */
export async function fetchFacturasSeguroElegibles(
  input: FacturasSeguroRequest,
  signal?: AbortSignal,
): Promise<FacturasSeguroPage> {
  try {
    const args = selectorRpcArgs(input);
    // SAFE-CAST: this disabled candidate RPC is not in the generated deployed
    // schema yet. Its narrow response is runtime-validated before use.
    const request = supabase.rpc("seguro_facturas_elegibles" as never, args as never);
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    if (error || signal?.aborted) throw new Error();
    return parseSelectorPage(data, args.p_limit, input.cursor);
  } catch {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    // Missing RPC, disabled release, denied context, timeout, malformed response:
    // one recoverable error. Never leak SQL diagnostics or claim an empty page.
    throw new Error(SEGURO_FACTURA_SELECTOR_ERROR);
  }
}

export async function fetchSegurosEmbarque(embarqueId: string): Promise<SeguroEmbarque[]> {
  const data = await unwrapOr(
    supabase
      .from("seguros_embarque")
      .select(COLUMNS)
      .eq("embarque_id", embarqueId)
      .is("deleted_at", null)
      .order("vigencia_desde", { ascending: false }),
    [],
  );
  // SAFE-CAST: COLUMNS lista explícita mapea 1:1 a SeguroEmbarque.
  return data as unknown as SeguroEmbarque[];
}

export async function createSeguroEmbarque(input: SeguroEmbarqueInput): Promise<SeguroEmbarque> {
  // organization_id se hereda del embarque si no se pasa.
  let orgId = input.organization_id;
  if (!orgId) {
    const emb = await unwrap(
      supabase
        .from("embarques")
        .select("organization_id")
        .eq("id", input.embarque_id)
        .maybeSingle(),
    );
    if (!emb?.organization_id) throw new Error("Embarque sin organización");
    orgId = emb.organization_id;
  }

  const data = await unwrap(
    supabase
      .from("seguros_embarque")
      .insert({ ...input, organization_id: orgId })
      .select(COLUMNS)
      .single(),
  );
  // SAFE-CAST: COLUMNS lista explícita mapea 1:1 a SeguroEmbarque.
  const seguro = data as unknown as SeguroEmbarque;
  await registrarBitacoraEmbarque({
    accion: "Creó seguro de embarque",
    entidadId: input.embarque_id,
    detalles: { seguroId: seguro.id, aseguradora: input.aseguradora, numeroPoliza: input.numero_poliza, sumaAseguradaUsd: input.suma_asegurada },
  });
  return seguro;
}

export async function updateSeguroEmbarque(
  id: string,
  patch: Partial<SeguroEmbarqueInput>,
): Promise<void> {
  await run(supabase.from("seguros_embarque").update(patch).eq("id", id));
  await registrarBitacoraEmbarque({
    accion: "Actualizó seguro de embarque",
    entidadId: patch.embarque_id,
    detalles: { seguroId: id, cambios: patch },
  });
}

export async function deleteSeguroEmbarque(id: string): Promise<void> {
  await run(
    supabase
      .from("seguros_embarque")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id),
  );
  await registrarBitacoraEmbarque({
    accion: "Eliminó seguro de embarque",
    detalles: { seguroId: id },
  });
}
