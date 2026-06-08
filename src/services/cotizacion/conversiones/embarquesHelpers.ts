/**
 * Cotizaciones — Helpers internos para convertir cotización → embarque(s).
 * Extraído de `embarques.ts` en 12.33.0 para mantener el orquestador <200 líneas.
 */
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow } from "@/types/cotizacion";
import { mapCostosACostosEmbarque } from "@/lib/domain/cotizacion";
import { fromDb } from "@/lib/supabase/cast";

type ContenedorInsert = TablesInsert<"embarque_contenedores">;
type ConceptoCostoInsert = TablesInsert<"conceptos_costo">;
type ConceptoVentaInsert = TablesInsert<"conceptos_venta">;
type Moneda = ConceptoVentaInsert["moneda"];

export interface TotalesCarga {
  pesoTotal: number;
  volumenTotal: number;
  piezasTotal: number;
}

/** Construye los N contenedores hijos repartiendo peso/volumen/piezas. */
export function construirHijosPayload(
  embarqueId: string,
  cotizacion: CotizacionRow,
  numContenedores: number,
  totales: TotalesCarga,
): ContenedorInsert[] {
  const pesoPorContenedor = totales.pesoTotal / numContenedores;
  const volumenPorContenedor = totales.volumenTotal / numContenedores;
  const piezasBase = Math.floor(totales.piezasTotal / numContenedores);
  let piezasRestantes = totales.piezasTotal;
  const out: ContenedorInsert[] = [];
  for (let i = 0; i < numContenedores; i++) {
    const esUltimo = i === numContenedores - 1;
    const piezasEste = esUltimo ? piezasRestantes : piezasBase;
    piezasRestantes -= piezasEste;
    out.push({
      embarque_id: embarqueId,
      numero_contenedor: "",
      tipo_contenedor: cotizacion.tipo_contenedor ?? "",
      bl_house: "",
      peso_kg: pesoPorContenedor,
      volumen_m3: volumenPorContenedor,
      piezas: piezasEste,
      orden: i + 1,
    });
  }
  return out;
}

/** Construye filas `conceptos_costo` para BL (general) o Contenedor (por hijo). */
export function construirCostosRows(
  costos: Tables<"cotizacion_costos">[],
  embarqueId: string,
  hijos: Tables<"embarque_contenedores">[],
): ConceptoCostoInsert[] {
  const rows: ConceptoCostoInsert[] = [];
  for (const costo of costos) {
    const um = costo.unidad_medida ?? "Contenedor";
    const base = mapCostosACostosEmbarque([costo], embarqueId)[0];
    if (um === "BL") {
      rows.push(fromDb<ConceptoCostoInsert>({ ...base, contenedor_id: null }));
    } else {
      for (const hijo of hijos) {
        rows.push(fromDb<ConceptoCostoInsert>({ ...base, contenedor_id: hijo.id }));
      }
    }
  }
  return rows;
}

/** Parsea el jsonb `conceptos_venta` de una cotización a filas `conceptos_venta`. */
export function parsearVentasJsonb(
  ventasJsonb: unknown[],
  embarqueId: string,
): ConceptoVentaInsert[] {
  return ventasJsonb
    .map((raw): ConceptoVentaInsert | null => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const v = fromDb<Record<string, unknown>>(raw);
      const descripcion = String(v.descripcion ?? "").trim();
      if (!descripcion) return null;
      return {
        embarque_id: embarqueId,
        descripcion,
        cantidad: Number(v.cantidad ?? 1),
        precio_unitario: Number(v.precio_unitario ?? 0),
        moneda: (v.moneda === "USD" ? "USD" : "MXN") as Moneda,
        aplica_iva: Boolean(v.aplica_iva ?? false),
        // Tasa por fila: si viene definida la respetamos (incluye 0 exento);
        // si no, derivamos 0.16 cuando aplica_iva=true ó 0 cuando no.
        tasa_iva_aplicada: typeof v.tasa_iva_aplicada === "number"
          ? Number(v.tasa_iva_aplicada)
          : (v.aplica_iva ? 0.16 : 0),
        total: Number(v.total ?? 0),
      };
    })
    .filter((v): v is ConceptoVentaInsert => v !== null);
}
