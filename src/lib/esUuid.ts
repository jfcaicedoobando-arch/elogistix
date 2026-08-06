/**
 * Validación de identificadores UUID de rutas.
 *
 * Las rutas de detalle (`/facturacion/:id`, `/embarques/:id`, etc.) reciben el
 * parámetro tal cual viene de la URL. Si el usuario llega con un segmento que
 * no es un UUID (por ejemplo `/facturacion/estado-cuenta`), la consulta a la
 * base responde 400 y la pantalla se queda en esqueleto. Validar antes evita
 * el viaje a la red y permite mostrar "no encontrado" de inmediato.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuid(valor: string | null | undefined): boolean {
  return typeof valor === "string" && UUID_REGEX.test(valor);
}
