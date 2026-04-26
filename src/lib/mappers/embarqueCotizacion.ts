/**
 * Mappers para vincular/desvincular una cotización a un formulario de embarque.
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
}

/** Devuelve los pares [campo, valor] para aplicar a un formulario al vincular cotización. */
export function buildVincularCotizacionUpdates(
  cot: CotizacionParaVincular,
): Array<[keyof EmbarqueFormValues, string]> {
  return [
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
    ["puertoOrigen", cot.origen || ""],
    ["puertoDestino", cot.destino || ""],
  ];
}

/** Devuelve los pares [campo, valor] para limpiar al desvincular cotización. */
export function buildDesvincularCotizacionUpdates(): Array<[keyof EmbarqueFormValues, string]> {
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
  ];
}
