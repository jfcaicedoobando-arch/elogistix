/**
 * Lógica de desvincular una cotización del formulario de embarque.
 * Extraído de `embarqueCotizacion.ts` (v13.44.8) para mantener cada archivo
 * dentro del límite de 200 líneas (regla Power of 10).
 */
import type { EmbarqueFormValues } from "./embarqueFromDb";
import type { DesvincularModo, VincularSnapshot } from "./embarqueCotizacion";

type FieldUpdate = [keyof EmbarqueFormValues, unknown];

const DESVINCULAR_DEFAULTS: Array<FieldUpdate> = [
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
  ["contenedores", []],
  // Pack B+ defaults
  ["tarifaId", ""],
  ["cartaGarantia", false],
  ["diasLibresDestino", "0"],
  ["diasAlmacenaje", "0"],
  ["seguro", false],
  ["valorSeguroUsd", ""],
  ["notas", ""],
  // Heredados desde tarifa (v13.303.35)
  ["agenteId", null],
  ["navieraId", null],
];

/**
 * Devuelve los pares [campo, valor] a aplicar al desvincular cotización.
 *
 * - `limpiar`: vacía todos los campos heredados. Si se pasa `snapshot` +
 *   `currentValues`, sólo se limpian los campos cuyo valor actual sigue
 *   siendo igual al snapshot (es decir, el usuario no los tocó). Los demás
 *   se respetan (Opción A).
 * - `conservar`: no toca campos del formulario, sólo se rompe el vínculo.
 * - `solo-conceptos`: el formulario queda intacto; el caller debe limpiar
 *    los conceptos por separado.
 */
export function buildDesvincularCotizacionUpdates(
  modo: DesvincularModo = "limpiar",
  snapshot?: VincularSnapshot,
  currentValues?: Partial<EmbarqueFormValues>,
): Array<FieldUpdate> {
  if (modo === "conservar" || modo === "solo-conceptos") return [];
  if (!snapshot || !currentValues) return DESVINCULAR_DEFAULTS;

  return DESVINCULAR_DEFAULTS.filter(([field]) => {
    if (!(field in snapshot)) return true; // campo no fue sembrado → limpiar default
    const snapVal = snapshot[field];
    const curVal = currentValues[field];
    // Igualdad estructural simple para strings/booleanos/arrays vacíos.
    if (Array.isArray(snapVal) && Array.isArray(curVal)) {
      return snapVal.length === curVal.length; // arrays: limpiar sólo si longitud intacta
    }
    return String(snapVal ?? "") === String(curVal ?? "");
  });
}
