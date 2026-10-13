/**
 * Fuentes de datos (Supabase) para la proyección de facturación.
 * Solo I/O: trae embarques del mes + sus conceptos/facturas. Sin agregaciones.
 */
import { fetchProjectionInChunks } from "./fetchInChunks";
import { supabase } from "@/integrations/supabase/client";
import { fetchFacturasEmitidasCierre, ventasPendientes } from "./ventasPendientes";
import { aplicarCursor, conAbortSignal, leerPaginasPorClave } from "@/lib/supabase/paginadoPorClave";
import { fetchVentaFacturadaEmbarques } from "@/features/facturacion/services/shared/ventaFacturada";
import { ESTADOS_EMBARQUE_NO_CONTABLES } from "@/features/embarques/domain/estadosContables";

export interface EmbarqueProyeccionRow {
  id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  operador: string | null;
  eta: string | null;
  contenedor: string | null;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
  tiene_proforma: boolean | null;
}

export async function fetchEmbarquesMes(
  organizationId: string | null,
  desde: string,
  hasta: string,
  signal?: AbortSignal,
): Promise<EmbarqueProyeccionRow[]> {
  if (!organizationId) throw new Error("Selecciona una organización para consultar la proyección.");
  const filas = await leerPaginasPorClave("cierre.embarques", (despues, lote) => conAbortSignal(aplicarCursor(supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, eta, contenedor, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma",
    )
    .is("deleted_at", null)
    .gte("eta", desde)
    .lte("eta", hasta)
    // Excluir embarques cancelados — alineado con Estado de Resultados
    // para que la proyección no infle ingresos con expedientes cancelados.
    .not("estado", "in", `(${ESTADOS_EMBARQUE_NO_CONTABLES.join(",")})`)
    .eq("organization_id", organizationId)
    .order("id", { ascending: true })
    .limit(lote), ["id"], despues), signal), (fila) => [fila.id], { signal });
  // La presentación conserva ETA + ID; la lectura usa sólo la clave inmutable.
  return filas.sort((a, b) => (a.eta ?? "\uffff").localeCompare(b.eta ?? "\uffff") || a.id.localeCompare(b.id));
}

export async function fetchConceptosYFacturas(
  ids: string[],
  _expedientes: string[],
  _organizationId?: string | null,
  signal?: AbortSignal,
) {
  // Fase 3 (alta #10): filtramos conceptos soft-eliminados para consistencia
  // con `estadoResultados` y evitar descuadre Proyección vs EERR.
  // AUD-ANALISIS-4: lectura por páginas; un mes con >1000 renglones ya no se
  // trunca en silencio.
  const [facturadas, proyectadas, costos, facturas] = await Promise.all([
    // AUD-ANALISIS-8: venta = facturas timbradas vigentes − notas de crédito.
    fetchProjectionInChunks(ids, (lote) => fetchVentaFacturadaEmbarques(lote, signal), signal),
    // AUD-ANALISIS-9: Cierre mensual ES una proyección; los embarques aún sin
    // factura usan su venta proyectada (conceptos) en "Pendiente de facturar".
    fetchProjectionInChunks(ids, (lote) => leerPaginasPorClave("cierre.ventas", (despues, tamano) =>
      conAbortSignal(aplicarCursor(supabase
        .from("conceptos_venta")
        .select("id, embarque_id, total, moneda, proforma_id")
        .in("embarque_id", lote)
        .is("deleted_at", null)
        .order("id")
        .limit(tamano), ["id"], despues), signal), (fila) => [fila.id], { signal },
    ), signal),
    fetchProjectionInChunks(ids, (lote) => leerPaginasPorClave("cierre.costos", (despues, tamano) =>
      conAbortSignal(aplicarCursor(supabase
        .from("conceptos_costo")
        .select("id, embarque_id, monto, moneda")
        .in("embarque_id", lote)
        .is("deleted_at", null)
        .order("id")
        .limit(tamano), ["id"], despues), signal), (fila) => [fila.id], { signal },
    ), signal),
    fetchFacturasEmitidasCierre(ids, signal),
  ]);
  // Keep projected and invoiced bases separate: one invoice does not bill the whole shipment.
  return { ventas: proyectadas, pendientes: ventasPendientes(proyectadas, facturas), facturadas, costos, facturas };
}
