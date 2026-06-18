/**
 * Helper puro de formateo de "sub-expediente" por contenedor.
 *
 * Política CargoWise-style (v13.66.14): un embarque sigue siendo UN expediente
 * (`ELIMP00272`). El sub-expediente (`ELIMP00272-01`) es únicamente una
 * etiqueta de display que identifica al contenedor dentro del embarque.
 * NO se guarda en BD ni constituye una entidad nueva.
 */

const SEPARADOR = "-";

/**
 * Devuelve `${expediente}-${orden con padding a 2}`.
 *
 * - Si `expediente` está vacío, regresa la cadena del orden con padding
 *   (sin separador) para no exponer un guión huérfano.
 * - Si `orden` es nulo, 0 o negativo, se normaliza a `1`.
 */
export function formatSubexpediente(
  expediente: string | null | undefined,
  orden: number | null | undefined,
): string {
  const ordenNormalizado =
    typeof orden === "number" && Number.isFinite(orden) && orden > 0
      ? Math.floor(orden)
      : 1;
  const sufijo = String(ordenNormalizado).padStart(2, "0");
  const exp = (expediente ?? "").trim();
  if (!exp) return sufijo;
  return `${exp}${SEPARADOR}${sufijo}`;
}
