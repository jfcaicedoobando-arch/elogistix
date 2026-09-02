/**
 * Saludo del encabezado de los tableros, anclado a la hora de NEGOCIO
 * (America/Mexico_City) y no a la zona del navegador.
 *
 * v13.823.23 — Antes cada tablero usaba `new Date().getHours()`, así que a las
 * 18:00 CDMX un usuario en UTC veía "Buenas noches" y otro "Buenos días".
 */
import { horaMx } from "@/lib/date/mx";

export function saludoMx(base: Date = new Date()): string {
  const h = horaMx(base);
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
