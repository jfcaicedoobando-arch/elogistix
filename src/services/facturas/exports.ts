/**
 * Hidratación de datos para exports/generadores de facturas.
 *
 * Centraliza las consultas a Supabase que antes vivían dentro de
 * `src/generators/layoutContable.ts` y `src/generators/estadoCuentaPdf.ts`.
 * Los generadores ahora reciben DTOs ya hidratados y se enfocan únicamente
 * en presentación (CSV / HTML / PDF).
 *
 * v8.205.0 — P0.4 auditoría arquitectónica.
 */
import { supabase } from "@/integrations/supabase/client";

export interface LayoutContableRow {
  numero: string;
  fecha_emision: string;
  subtotal: number | null;
  iva: number | null;
  total: number;
  moneda: string;
  tipo_cambio: number | null;
  expediente: string;
  referencia_bl: string | null;
  estado: string;
  cliente_id: string | null;
  cliente_nombre: string;
}

export interface LayoutContableData {
  facturas: LayoutContableRow[];
  rfcByClienteId: Map<string, string>;
}

/**
 * Carga las facturas indicadas + el RFC de sus clientes en una sola operación.
 * Devuelve un DTO listo para que el generador CSV mapee filas sin hacer I/O.
 */
export async function fetchLayoutContableData(facturaIds: string[]): Promise<LayoutContableData> {
  if (facturaIds.length === 0) return { facturas: [], rfcByClienteId: new Map() };

  const { data: rows, error } = await supabase
    .from("facturas")
    .select(
      "numero, fecha_emision, subtotal, iva, total, moneda, tipo_cambio, expediente, referencia_bl, estado, cliente_id, cliente_nombre",
    )
    .in("id", facturaIds);
  if (error) throw error;

  const facturas = (rows ?? []) as LayoutContableRow[];
  const clienteIds = Array.from(
    new Set(facturas.map((r) => r.cliente_id).filter((x): x is string => !!x)),
  );

  const rfcByClienteId = new Map<string, string>();
  if (clienteIds.length > 0) {
    const { data: clientes, error: cErr } = await supabase
      .from("clientes")
      .select("id, rfc")
      .in("id", clienteIds);
    if (cErr) throw cErr;
    for (const c of clientes ?? []) {
      if (c.rfc) rfcByClienteId.set(c.id, c.rfc);
    }
  }

  return { facturas, rfcByClienteId };
}

export interface EstadoCuentaFactura {
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total: number;
  moneda: string;
  estado: string;
  expediente: string;
}

/**
 * Devuelve las facturas Emitidas/Vencidas de un cliente, ordenadas por
 * fecha de emisión ascendente, listas para el generador de estado de cuenta.
 */
export async function fetchEstadoCuentaFacturas(clienteId: string): Promise<EstadoCuentaFactura[]> {
  const { data, error } = await supabase
    .from("facturas")
    .select("numero, fecha_emision, fecha_vencimiento, total, moneda, estado, expediente")
    .eq("cliente_id", clienteId)
    .in("estado", ["Emitida", "Vencida"])
    .order("fecha_emision", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EstadoCuentaFactura[];
}
