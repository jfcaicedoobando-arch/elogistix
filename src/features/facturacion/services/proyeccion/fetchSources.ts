/**
 * Fuentes de datos (Supabase) para la proyección de facturación.
 * Solo I/O: trae embarques del mes + sus conceptos/facturas. Sin agregaciones.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchFacturasPorExpedientes } from "@/features/facturacion/services/shared/fetchFacturas";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
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
): Promise<EmbarqueProyeccionRow[]> {
  let q = supabase
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
    .order("eta", { ascending: true });
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchConceptosYFacturas(
  ids: string[],
  expedientes: string[],
  organizationId?: string | null,
) {
  // Fase 3 (alta #10): filtramos conceptos soft-eliminados para consistencia
  // con `estadoResultados` y evitar descuadre Proyección vs EERR.
  // AUD-ANALISIS-4: lectura por páginas; un mes con >1000 renglones ya no se
  // trunca en silencio.
  const [ventas, costos, facturas] = await Promise.all([
    // AUD-ANALISIS-8: venta = facturas timbradas vigentes − notas de crédito.
    fetchVentaFacturadaEmbarques(ids),
    leerTodasLasPaginas("cierre.costos", (ini, fin) =>
      supabase
        .from("conceptos_costo")
        .select("id, embarque_id, monto, moneda")
        .in("embarque_id", ids)
        .is("deleted_at", null)
        .order("id")
        .range(ini, fin),
    ),
    fetchFacturasPorExpedientes(expedientes, organizationId),
  ]);
  return { ventas, costos, facturas };
}
