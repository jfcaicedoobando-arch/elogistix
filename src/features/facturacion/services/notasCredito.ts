/**
 * Notas de crédito internas (CxC – Sprint 1).
 *
 * Máquina canónica (espejo EXACTO de public.guard_nc_cliente_transicion,
 * FIX2 ronda 2):
 *   Borrador  → {Timbrada, Cancelada}
 *   Timbrada  → {Aplicada, Cancelada}
 *   Aplicada  → {Cancelada}
 *   Aprobada  → {Timbrada, Cancelada}  (legado, sólo salida)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { getCurrentUser } from "@/features/auth/services";
import { run, unwrap, unwrapOr } from "@/lib/supabase/response";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import { registrarActividad } from "@/services/bitacora/registrar";

export type NotaCredito = Tables<"factura_notas_credito">;
export type EstadoNotaCredito = NotaCredito["estado"];

export interface ConceptoNotaCredito {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string | null;
  clave_unidad?: string | null;
  unidad?: string | null;
  tasa_iva?: number | null;
  /** Ola 4 · N19: régimen de IVA del concepto (gravado_16 | tasa_0 | exento). */
  tipo_iva?: "gravado_16" | "tasa_0" | "exento" | null;
}

export interface CrearNotaCreditoInput {
  factura_id: string;
  /** Opcional: si no viene, se asigna `BORRADOR-<ts>` (mismo patrón que facturas). */
  folio?: string;
  motivo: NotaCredito["motivo"];
  descripcion: string;
  monto: number;
  moneda: NotaCredito["moneda"];
  tipo_cambio: number;
  fecha_emision: string;
  serie?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  conceptos?: ConceptoNotaCredito[];
}


export async function listarNotasCreditoPorFactura(facturaId: string): Promise<NotaCredito[]> {
  return unwrapOr(
    supabase
      .from("factura_notas_credito")
      .select("*")
      .eq("factura_id", facturaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    [],
  );
}

export interface NotaCreditoConFactura extends NotaCredito {
  factura_numero: string;
  cliente_id: string;
  cliente_nombre: string;
}

export interface ListarNotasCreditoRecientesFiltros {
  cliente_id?: string;
  estado?: EstadoNotaCredito | "todos";
  limit?: number;
}

/**
 * Lista las notas de crédito más recientes en toda la cartera, con datos
 * básicos de la factura asociada. Usado por la vista consolidada de NCs
 * dentro de Cobranza (G de la auditoría 13.49.0).
 */
export async function listarNotasCreditoRecientes(
  filtros: ListarNotasCreditoRecientesFiltros = {},
): Promise<NotaCreditoConFactura[]> {
  const limit = filtros.limit ?? 100;
  let query = supabase
    .from("factura_notas_credito")
    .select(`
      *,
      facturas!inner(numero, cliente_id, cliente_nombre)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filtros.cliente_id) query = query.eq("facturas.cliente_id", filtros.cliente_id);
  if (filtros.estado && filtros.estado !== "todos") query = query.eq("estado", filtros.estado);

  const data = await unwrapOr(query, []);
  type RawRow = NotaCredito & { facturas: { numero: string; cliente_id: string; cliente_nombre: string } | null };
  // SAFE-CAST: el join embebido `facturas!inner` viene como objeto anidado.
  return (data as unknown as RawRow[]).map((row) => {
    const { facturas, ...nota } = row;
    return {
      ...nota,
      factura_numero: facturas?.numero ?? "—",
      cliente_id: facturas?.cliente_id ?? "",
      cliente_nombre: facturas?.cliente_nombre ?? "—",
    };
  });
}

export async function crearNotaCredito(input: CrearNotaCreditoInput): Promise<NotaCredito> {
  const user = await getCurrentUser();
  const { conceptos, folio, ...rest } = input;
  // v13.213.20 — patrón "FacturAPI = source of truth" (mismo que facturas):
  // el borrador arranca con folio provisional `BORRADOR-<ts>` y al timbrar
  // la edge `facturapi-emitir-nota-credito` lo sobreescribe con `<serie><folio>`.
  const folioFinal = folio?.trim() || `BORRADOR-${Date.now().toString().slice(-8)}`;
  const payload: TablesInsert<"factura_notas_credito"> = {
    ...rest,
    folio: folioFinal,
    // SAFE-CAST: ConceptoNotaCredito[] es serializable a Json (objetos planos).
    conceptos: (conceptos ?? []) as unknown as TablesInsert<"factura_notas_credito">["conceptos"],
    created_by: user.id,
    estado: "Borrador",
  };
  const nota = await unwrap(
    supabase.from("factura_notas_credito").insert(payload).select("*").single(),
  );
  await registrarActividad({
    modulo: "facturacion",
    accion: "Creó nota de crédito",
    entidadId: nota.id,
    entidadNombre: nota.folio,
    detalles: {
      factura_id: input.factura_id,
      motivo: input.motivo,
      monto: input.monto,
      moneda: input.moneda,
    },
  });
  return nota;
}


function asegurarTransicion(actual: EstadoNotaCredito, siguiente: EstadoNotaCredito): void {
  const validas: Record<EstadoNotaCredito, EstadoNotaCredito[]> = {
    // Espejo EXACTO de public.guard_nc_cliente_transicion (FIX2 ronda 2).
    Borrador: ["Timbrada", "Cancelada"],
    Aprobada: ["Timbrada", "Cancelada"],
    Timbrada: ["Aplicada", "Cancelada"],
    Aplicada: ["Cancelada"],
    Cancelada: [],
  };
  if (!validas[actual].includes(siguiente)) {
    throw new Error(`Transición inválida: ${actual} → ${siguiente}`);
  }
}

export async function cambiarEstadoNotaCredito(
  id: string,
  estadoActual: EstadoNotaCredito,
  estadoNuevo: EstadoNotaCredito,
  /**
   * N-06 (QA r2): bloqueo optimista. Junto con el filtro por `estado` garantiza
   * que la NC sigue exactamente como estaba cuando se validó la transición.
   */
  expectedUpdatedAt?: string | null,
): Promise<void> {
  asegurarTransicion(estadoActual, estadoNuevo);
  const patch: Partial<NotaCredito> = { estado: estadoNuevo };
  if (estadoNuevo === "Aprobada") {
    const user = await getCurrentUser();
    patch.aprobada_por = user.id;
    patch.aprobada_at = new Date().toISOString();
  }
  let query = supabase
    .from("factura_notas_credito")
    .update(patch)
    .eq("id", id)
    .eq("estado", estadoActual);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const filas = await unwrapOr(query.select("id"), []);
  if (filas.length === 0) throw conflictoConcurrenciaError();
  await registrarActividad({
    modulo: "facturacion",
    accion: `Cambió estado de nota de crédito a ${estadoNuevo}`,
    entidadId: id,
    detalles: { estado_anterior: estadoActual, estado_nuevo: estadoNuevo },
  });
}
