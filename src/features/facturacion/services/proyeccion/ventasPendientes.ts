import { supabase } from "@/integrations/supabase/client";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";

const CAMPOS = "id, embarque_id, proforma_id, expediente, factura_pdf_url, moneda, subtotal, tipo_cambio, conceptos_factura(embarque_id, proforma_id_origen, total, deleted_at), factura_embarques(embarque_id, activa)";
interface ConceptoEmitido {
  embarque_id: string | null;
  proforma_id_origen: string | null;
  total: number | null;
  deleted_at: string | null;
}
export interface FacturaCierre {
  id: string;
  embarque_id: string | null;
  proforma_id: string | null;
  moneda: string;
  subtotal: number;
  conceptos_factura: ConceptoEmitido[];
  factura_embarques?: { embarque_id: string; activa: boolean | null }[];
}
export interface VentaProyectada {
  embarque_id: string;
  proforma_id?: string | null;
  total: number | null;
  moneda: string | null;
}

/** Emission, not a PDF or cached proforma status, establishes coverage. */
export async function fetchFacturasEmitidasCierre(ids: string[]) {
  const [cabeceras, enlaces, vinculos] = await Promise.all([
    leerTodasLasPaginas("cierre.emitidas", (ini, fin) => supabase.from("facturas")
      .select(CAMPOS).in("embarque_id", ids).in("estado", [...FACTURA_ESTADOS_VIVOS])
      .is("deleted_at", null).order("id").range(ini, fin)),
    leerTodasLasPaginas("cierre.enlaces", (ini, fin) => supabase.from("conceptos_factura")
      .select("id, factura_id").in("embarque_id", ids).is("deleted_at", null)
      .order("id").range(ini, fin)),
    leerTodasLasPaginas("cierre.vinculos", (ini, fin) => supabase.from("factura_embarques")
      .select("factura_id, embarque_id").in("embarque_id", ids).eq("activa", true)
      .order("factura_id").order("embarque_id").range(ini, fin)),
  ]);
  const directas = new Set(cabeceras.map((f) => f.id));
  const indirectas = [...new Set([...enlaces, ...vinculos].map((c) => c.factura_id))].filter((id) => !directas.has(id));
  const consolidadas = await fetchInChunks(indirectas, async (lote) => {
    const { data, error } = await supabase.from("facturas").select(CAMPOS).in("id", lote)
      .in("estado", [...FACTURA_ESTADOS_VIVOS]).is("deleted_at", null);
    if (error) throw error;
    return data ?? [];
  });
  return [...cabeceras, ...consolidadas];
}

const clave = (embarque: string, moneda: string | null, proforma: string | null | undefined) =>
  `${embarque}|${moneda ?? "MXN"}|${proforma ?? ""}`;

function destinosFactura(f: FacturaCierre): string[] {
  const activos = f.factura_embarques?.filter((v) => v.activa).map((v) => v.embarque_id) ?? [];
  return activos.length ? activos : f.embarque_id ? [f.embarque_id] : [];
}

/** Gross invoice base covers work already billed. NCs change net sales only. */
export function ventasPendientes(ventas: VentaProyectada[], facturas: FacturaCierre[]): VentaProyectada[] {
  return descontarCobertura(agruparVentas(ventas), coberturaEmitida(facturas));
}

function coberturaEmitida(facturas: FacturaCierre[]): Map<string, number> {
  const cobertura = new Map<string, number>();
  for (const f of facturas) {
    const lineas = f.conceptos_factura.filter((c) => !c.deleted_at && c.embarque_id && Number(c.total) > 0);
    const totalLineas = f.conceptos_factura.filter((c) => !c.deleted_at)
      .reduce((s, c) => s + Number(c.total), 0);
    if (lineas.length > 0 && totalLineas > 0) {
      for (const c of lineas) {
        const key = clave(c.embarque_id!, f.moneda, c.proforma_id_origen ?? f.proforma_id);
        cobertura.set(key, (cobertura.get(key) ?? 0) + f.subtotal * Number(c.total) / totalLineas);
      }
    } else {
      const destinos = destinosFactura(f);
      for (const id of destinos) {
        const key = clave(id, f.moneda, f.proforma_id);
        cobertura.set(key, (cobertura.get(key) ?? 0) + f.subtotal / destinos.length);
      }
    }
  }
  return cobertura;
}

function agruparVentas(ventas: VentaProyectada[]): Map<string, VentaProyectada> {
  const grupos = new Map<string, VentaProyectada>();
  for (const venta of ventas) {
    const key = clave(venta.embarque_id, venta.moneda, venta.proforma_id);
    const previa = grupos.get(key);
    grupos.set(key, { ...venta, total: Number(previa?.total ?? 0) + Number(venta.total ?? 0) });
  }
  return grupos;
}

/** Origin-less legacy coverage is consumed once, after identified origins. */
function descontarCobertura(grupos: Map<string, VentaProyectada>, cobertura: Map<string, number>): VentaProyectada[] {
  const sinOrigen = new Map(cobertura);
  const pendientes = [...grupos].map(([key, venta]) => {
    const cubierta = Math.min(Number(venta.total), cobertura.get(key) ?? 0);
    if (!venta.proforma_id) sinOrigen.set(key, (cobertura.get(key) ?? 0) - cubierta);
    return { ...venta, total: Math.max(0, Number(venta.total) - cubierta) };
  });
  for (const venta of pendientes) {
    if (!venta.proforma_id) continue;
    const key = clave(venta.embarque_id, venta.moneda, null);
    const disponible = sinOrigen.get(key) ?? 0;
    const cubierta = Math.min(venta.total, disponible);
    venta.total -= cubierta;
    sinOrigen.set(key, disponible - cubierta);
  }
  return pendientes.filter((venta) => venta.total > 0);
}
