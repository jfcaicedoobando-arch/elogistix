/**
 * Mappers para vincular/desvincular una cotización a un formulario de embarque.
 *
 * v13.28.0 — Precarga ampliada:
 *  - Rutas dirigidas al campo correcto del embarque según `modo`
 *    (Marítimo → puertos, Aéreo → aeropuertos, Terrestre → ciudades).
 *  - Se incluye `msdsArchivo` cuando la cotización trae MSDS cargado.
 *  - `buildDesvincularCotizacionUpdates` ahora acepta un modo (`limpiar` |
 *    `conservar` | `solo-conceptos`) para soportar el diálogo de desvincular.
 */

import type { EmbarqueFormValues } from "./embarqueFromDb";

export interface CotizacionParaVincular {
  cliente_id: string | null;
  modo: string;
  tipo: string;
  incoterm: string;
  descripcion_mercancia: string;
  tipo_carga: string;
  tipo_contenedor: string | null;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
  msds_archivo?: string | null;
}

export type DesvincularModo = "limpiar" | "conservar" | "solo-conceptos";

type FieldUpdate = [keyof EmbarqueFormValues, string];

const norm = (s: string) => s.trim().toLowerCase();
const esModoMaritimo = (m: string) => ["maritimo", "marítimo"].includes(norm(m));
const esModoAereo = (m: string) => ["aereo", "aéreo"].includes(norm(m));

/** Devuelve los pares [campo, valor] para aplicar a un formulario al vincular cotización. */
export function buildVincularCotizacionUpdates(
  cot: CotizacionParaVincular,
): Array<FieldUpdate> {
  const base: FieldUpdate[] = [
    ["clienteId", cot.cliente_id || ""],
    ["modo", cot.modo],
    ["tipo", cot.tipo],
    ["incoterm", cot.incoterm],
    ["descripcionMercancia", cot.descripcion_mercancia],
    ["tipoCarga", cot.tipo_carga || "Carga General"],
    ["tipoContenedor", cot.tipo_contenedor || ""],
    ["pesoKg", String(cot.peso_kg || "")],
    ["volumenM3", String(cot.volumen_m3 || "")],
    ["piezas", String(cot.piezas || "")],
  ];

  // Rutas dirigidas al campo correcto según modo de transporte.
  if (esModoMaritimo(cot.modo)) {
    base.push(["puertoOrigen", cot.origen || ""], ["puertoDestino", cot.destino || ""]);
  } else if (esModoAereo(cot.modo)) {
    base.push(["aeropuertoOrigen", cot.origen || ""], ["aeropuertoDestino", cot.destino || ""]);
  } else {
    base.push(["ciudadOrigen", cot.origen || ""], ["ciudadDestino", cot.destino || ""]);
  }

  if (cot.msds_archivo) {
    base.push(["msdsArchivo", cot.msds_archivo]);
  }

  return base;
}

/**
 * Devuelve los pares [campo, valor] a aplicar al desvincular cotización.
 *
 * - `limpiar` (default histórico): vacía todos los campos heredados.
 * - `conservar`: no toca campos del formulario, sólo se rompe el vínculo.
 * - `solo-conceptos`: el formulario queda intacto; el caller debe limpiar
 *    los conceptos por separado (no es responsabilidad de este mapper).
 */
export function buildDesvincularCotizacionUpdates(
  modo: DesvincularModo = "limpiar",
): Array<FieldUpdate> {
  if (modo === "conservar" || modo === "solo-conceptos") return [];

  return [
    ["clienteId", ""],
    ["modo", ""],
    ["tipo", ""],
    ["incoterm", "FOB"],
    ["descripcionMercancia", ""],
    ["tipoCarga", "Carga General"],
    ["tipoContenedor", ""],
    ["pesoKg", ""],
    ["volumenM3", ""],
    ["piezas", ""],
    ["puertoOrigen", ""],
    ["puertoDestino", ""],
    ["aeropuertoOrigen", ""],
    ["aeropuertoDestino", ""],
    ["ciudadOrigen", ""],
    ["ciudadDestino", ""],
    ["msdsArchivo", ""],
  ];
}
