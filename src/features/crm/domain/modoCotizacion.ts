/**
 * Mapeo canónico del modo de transporte del CRM al enum del cotizador.
 *
 * Vivía dentro de `useCrearCotizacionDesdeOportunidad`; se extrajo para que el
 * acceso directo "Nueva cotización" desde una oportunidad de prospecto
 * (CRM-COT-01) use exactamente el mismo mapeo y no invente valores.
 *
 * CRM-P1.3: el CRM acepta texto libre ("Marítimo FCL", "Aereo consolidado"),
 * así que el mapeo exacto dejaba el cotizador sin modo. Ahora se normaliza
 * (sin acentos/mayúsculas) y se acepta la variante SÓLO si el texto empieza con
 * un modo conocido; cualquier otro valor devuelve `null` para que el usuario
 * elija explícitamente (nunca se asume "Marítimo").
 */
export type ModoCotizacion = "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal";

const MODOS: { clave: string; modo: ModoCotizacion }[] = [
  { clave: "maritimo", modo: "Marítimo" },
  { clave: "aereo", modo: "Aéreo" },
  { clave: "terrestre", modo: "Terrestre" },
  { clave: "multimodal", modo: "Multimodal" },
];

const plano = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Devuelve el modo del cotizador equivalente, o `null` si el valor del CRM no
 * corresponde a ninguno (p. ej. "FCL", que es tipo de carga, no modo). Quien
 * necesite un valor obligatorio debe pedir la selección al usuario: no existe
 * un default seguro.
 */
export function mapModoCrmACotizacion(modo: string | null | undefined): ModoCotizacion | null {
  if (!modo) return null;
  const valor = plano(modo);
  if (!valor) return null;
  const hit = MODOS.find(
    ({ clave }) => valor === clave || valor.startsWith(`${clave} `),
  );
  return hit?.modo ?? null;
}
