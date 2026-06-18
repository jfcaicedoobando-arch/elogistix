/**
 * Cotizaciones — Helpers internos para convertir cotización → embarque(s).
 * Extraído de `embarques.ts` en 12.33.0 para mantener el orquestador <200 líneas.
 */
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow } from "@/features/cotizacion/types";
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

/**
 * Parsea el jsonb `conceptos_venta` de una cotización a filas `conceptos_venta`.
 *
 * v13.66.13: simétrico con `construirCostosRows`. Cuando
 * `unidad_medida === 'Contenedor'` (default) y hay hijos, la fila se REPLICA
 * una vez por cada contenedor conservando `cantidad` y `precio_unitario`
 * originales (el monto se MULTIPLICA por N contenedores, igual que costos).
 * Cuando `unidad_medida === 'BL'` o no hay hijos, se inserta una sola fila
 * con `contenedor_id = null` (concepto general / legacy).
 */
export function parsearVentasJsonb(
  ventasJsonb: unknown[],
  embarqueId: string,
  hijos?: Pick<Tables<"embarque_contenedores">, "id">[],
): ConceptoVentaInsert[] {
  const out: ConceptoVentaInsert[] = [];
  for (const raw of ventasJsonb) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const v = fromDb<Record<string, unknown>>(raw);
    const descripcion = String(v.descripcion ?? "").trim();
    if (!descripcion) continue;

    const cantidad = Number(v.cantidad ?? 1);
    const precioUnitario = Number(v.precio_unitario ?? 0);
    const moneda = (v.moneda === "USD" ? "USD" : "MXN") as Moneda;
    const aplicaIva = Boolean(v.aplica_iva ?? false);
    const tasaIva = typeof v.tasa_iva_aplicada === "number"
      ? Number(v.tasa_iva_aplicada)
      : (aplicaIva ? 0.16 : 0);
    const unidadMedida = String(v.unidad_medida ?? "Contenedor");
    const totalCotizado = Number(v.total ?? cantidad * precioUnitario);

    const esPorContenedor = unidadMedida.toLowerCase() === "contenedor";
    const numHijos = hijos?.length ?? 0;

    if (esPorContenedor && numHijos > 0) {
      // Replicar SIN dividir: cada contenedor lleva su propio monto completo.
      for (let i = 0; i < numHijos; i++) {
        out.push({
          embarque_id: embarqueId,
          descripcion,
          cantidad,
          precio_unitario: precioUnitario,
          moneda,
          aplica_iva: aplicaIva,
          tasa_iva_aplicada: tasaIva,
          total: cantidad * precioUnitario,
          contenedor_id: hijos![i].id,
        });
      }
    } else {
      // BL o sin hijos → 1 fila general (contenedor_id null).
      out.push({
        embarque_id: embarqueId,
        descripcion,
        cantidad,
        precio_unitario: precioUnitario,
        moneda,
        aplica_iva: aplicaIva,
        tasa_iva_aplicada: tasaIva,
        total: totalCotizado,
      });
    }
  }
  return out;
}

