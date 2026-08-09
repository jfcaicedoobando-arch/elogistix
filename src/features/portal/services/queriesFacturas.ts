/**
 * Queries de facturación del Portal del Cliente.
 * Extraído de `queries.ts` para mantener ambos archivos bajo 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import {
  PORTAL_FACTURA_LIST_COLUMNS,
  PORTAL_FACTURA_DETAIL_COLUMNS,
  PORTAL_PAGO_FACTURA_COLUMNS,
  PORTAL_NOTA_CREDITO_COLUMNS,
} from "./columns";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import { PORTAL_LIST_MAX, PORTAL_RELATED_MAX } from "./limits";

export async function fetchPortalFacturas(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const facturas = await unwrapOr(
    supabase
      .from("facturas")
      .select(PORTAL_FACTURA_LIST_COLUMNS)
      .in("cliente_id", clienteIds)
      // Portal: sólo CFDI vigentes; detalle sí accesible por URL directa.
      .in("estado", [...FACTURA_ESTADOS_VIVOS])
      .order("fecha_emision", { ascending: false })
      .limit(PORTAL_LIST_MAX),
    [],
  );

  // B-106: fallback al expediente del embarque cuando la factura no lo trae
  // (mismo patrón batch que fetchPortalCotizaciones).
  const embarqueIds = facturas
    .filter((f) => !f.expediente && f.embarque_id)
    .map((f) => f.embarque_id as string);
  if (embarqueIds.length === 0) {
    return facturas.map((f) => ({ ...f, embarque_expediente: null as string | null }));
  }
  const embs = await unwrapOr(
    supabase.from("embarques").select("id, expediente").in("id", embarqueIds),
    [],
  );
  const expById = new Map(embs.map((e) => [e.id, e.expediente]));
  return facturas.map((f) => ({
    ...f,
    embarque_expediente: f.embarque_id ? expById.get(f.embarque_id) ?? null : null,
  }));
}

export async function fetchPortalFactura(id: string) {
  const data = await unwrap(
    supabase
      .from("facturas")
      .select(PORTAL_FACTURA_DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle(),
  );
  // B-106: expediente de respaldo desde el embarque vinculado (tolera RLS).
  let embarque_expediente: string | null = null;
  if (data && !data.expediente && data.embarque_id) {
    const { data: emb } = await supabase
      .from("embarques")
      .select("expediente")
      .eq("id", data.embarque_id)
      .maybeSingle();
    embarque_expediente = emb?.expediente ?? null;
  }
  return data ? { ...data, embarque_expediente } : data;
}

export async function fetchPortalPagosFactura(facturaId: string) {
  return unwrapOr(
    supabase
      .from("pagos_factura")
      .select(PORTAL_PAGO_FACTURA_COLUMNS)
      .eq("factura_id", facturaId)
      // A6: el cliente no debe ver pagos que fueron eliminados internamente.
      .is("deleted_at", null)
      .order("fecha_pago", { ascending: false })
      .limit(PORTAL_RELATED_MAX),
    [],
  );
}

// B-082: notas de crédito aplicadas de una factura. Misma regla que el
// estado de cuenta (estadoCuenta.ts): solo "Aplicada" y no borradas.
export async function fetchPortalNotasCreditoFactura(facturaId: string) {
  return unwrapOr(
    supabase
      .from("factura_notas_credito")
      .select(PORTAL_NOTA_CREDITO_COLUMNS)
      .eq("factura_id", facturaId)
      .eq("estado", "Aplicada")
      // Fase Q.1: ocultar registros borrados al cliente.
      .is("deleted_at", null)
      .order("fecha_emision", { ascending: false })
      .limit(PORTAL_RELATED_MAX),
    [],
  );
}
