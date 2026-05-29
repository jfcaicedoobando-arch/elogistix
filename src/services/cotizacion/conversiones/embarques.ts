/**
 * Cotizaciones — Conversión: Cotización → 1 embarque con N contenedores hijos.
 * Modelo 1↔N (v12.10): cotización con N contenedores genera UN embarque + N hijos.
 * Costos "Contenedor" se replican por hijo; "BL" se insertan una vez (general).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow } from "@/types/cotizacion";
import { mapCostosACostosEmbarque } from "@/lib/domain/cotizacion";
import { fromDb } from "@/lib/supabase/cast";

type CotizacionInsert = TablesInsert<"cotizaciones">;
type EmbarqueInsert = TablesInsert<"embarques">;
type ContenedorInsert = TablesInsert<"embarque_contenedores">;
type ConceptoCostoInsert = TablesInsert<"conceptos_costo">;
type ConceptoVentaInsert = TablesInsert<"conceptos_venta">;
type Moneda = ConceptoVentaInsert["moneda"];
interface TotalesCarga { pesoTotal: number; volumenTotal: number; piezasTotal: number }


/** Construye los N contenedores hijos repartiendo peso/volumen/piezas. */
function construirHijosPayload(
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

/** Inserta costos en lotes (BL una vez, por contenedor para el resto). */
async function insertarCostosEmbarque(
  costos: Tables<"cotizacion_costos">[] | null,
  embarqueId: string,
  hijos: Tables<"embarque_contenedores">[] | null,
): Promise<void> {
  if (!costos || costos.length === 0 || !hijos || hijos.length === 0) return;
  const rows = construirCostosRows(costos, embarqueId, hijos);
  if (rows.length === 0) return;
  const { error } = await supabase.from("conceptos_costo").insert(rows);
  if (error) throw error;
}

/** Inserta conceptos_venta parseando el jsonb de la cotización. */
async function insertarVentasEmbarque(
  ventasJsonb: unknown[],
  embarqueId: string,
): Promise<void> {
  if (ventasJsonb.length === 0) return;
  const ventasRows = parsearVentasJsonb(ventasJsonb, embarqueId);
  if (ventasRows.length === 0) return;
  const { error } = await supabase.from("conceptos_venta").insert(ventasRows);
  if (error) throw error;
}

/** Construye filas `conceptos_costo` para BL (general) o Contenedor (por hijo). */
function construirCostosRows(
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
function parsearVentasJsonb(
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
        total: Number(v.total ?? 0),
      };
    })
    .filter((v): v is ConceptoVentaInsert => v !== null);
}

export async function convertirCotizacionAEmbarques(
  cotizacion: CotizacionRow,
): Promise<Tables<"embarques">[]> {
  const { data: costos, error: errorCostos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacion.id);
  if (errorCostos) throw errorCostos;

  const numContenedores = Math.max(1, cotizacion.num_contenedores ?? 1);
  const pesoTotal = Number(cotizacion.peso_kg ?? 0);
  const volumenTotal = Number(cotizacion.volumen_m3 ?? 0);
  const piezasTotal = Number(cotizacion.piezas ?? 0);

  // 1) Expediente único para el embarque consolidado.
  const { data: expediente, error: errorExp } = await supabase.rpc("generar_expediente", {
    tipo_op: cotizacion.tipo,
  });
  if (errorExp) throw errorExp;

  // 2) Crear el embarque (campos legacy quedan como caché del primer hijo vía trigger).
  const embarqueInsert: EmbarqueInsert = {
    cotizacion_id: cotizacion.id,
    expediente: expediente as string,
    cliente_id: cotizacion.cliente_id!,
    cliente_nombre: cotizacion.cliente_nombre,
    estado: "Confirmado",
    modo: cotizacion.modo,
    tipo: cotizacion.tipo,
    incoterm: cotizacion.incoterm,
    descripcion_mercancia: cotizacion.descripcion_mercancia,
    peso_kg: pesoTotal,
    volumen_m3: volumenTotal,
    piezas: piezasTotal,
    operador: cotizacion.operador,
    tipo_carga: cotizacion.tipo_carga,
    tipo_contenedor: cotizacion.tipo_contenedor,
  };

  const { data: embarque, error: errorEmb } = await supabase
    .from("embarques")
    .insert(embarqueInsert)
    .select()
    .single();
  if (errorEmb) throw errorEmb;

  // 3) Crear los N contenedores hijos.
  const hijosPayload = construirHijosPayload(
    embarque.id, cotizacion, numContenedores,
    { pesoTotal, volumenTotal, piezasTotal },
  );
  const { data: hijosCreados, error: errorHijos } = await supabase
    .from("embarque_contenedores")
    .insert(hijosPayload)
    .select()
    .order("orden");
  if (errorHijos) throw errorHijos;

  // 4) Insertar costos (BL una vez, contenedor por hijo).
  await insertarCostosEmbarque(costos, embarque.id, hijosCreados);

  // 5) Insertar conceptos_venta desde el jsonb de la cotización (v12.13.1 hardening).
  const ventasJsonb = Array.isArray(cotizacion.conceptos_venta) ? cotizacion.conceptos_venta : [];
  await insertarVentasEmbarque(ventasJsonb, embarque.id);

  // 6) Marcar cotización como "En operación" y vincularla al embarque.
  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({
      estado: "En operación" as CotizacionInsert["estado"],
      embarque_id: embarque.id,
    })
    .eq("id", cotizacion.id);
  if (errorUpdate) throw errorUpdate;

  return [embarque];
}
