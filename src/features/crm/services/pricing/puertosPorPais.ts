/**
 * Helpers puros para la ruta de la solicitud de pricing: países del catálogo
 * de puertos y filtrado de puertos por país. El país se guarda como texto en
 * `origen`/`destino` y el puerto como etiqueta "Nombre, País (CÓDIGO)" en
 * `pol`/`pod` (sin columnas nuevas ni migraciones).
 */
import { etiquetaPuerto, type PuertoOption } from "@/features/catalogos";

/** Países con al menos un puerto activo, ordenados en español. */
export function paisesDePuertos(puertos: readonly PuertoOption[]): string[] {
  const set = new Set<string>();
  for (const p of puertos) {
    if (p.activo === false) continue;
    const pais = p.country?.trim();
    if (pais) set.add(pais);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

/** Puertos activos de un país (comparación sin distinguir mayúsculas). */
export function puertosDePais(puertos: readonly PuertoOption[], pais: string | null | undefined): PuertoOption[] {
  const objetivo = (pais ?? "").trim().toLowerCase();
  if (!objetivo) return [];
  return puertos.filter(
    (p) => p.activo !== false && p.country?.trim().toLowerCase() === objetivo,
  );
}

/**
 * Etiqueta del puerto a conservar tras cambiar el país: si el puerto guardado
 * ya no pertenece al país nuevo, se limpia (devuelve null).
 */
export function puertoTrasCambioPais(
  puertos: readonly PuertoOption[],
  paisNuevo: string | null | undefined,
  etiquetaGuardada: string | null | undefined,
): string | null {
  if (!etiquetaGuardada) return null;
  const sigue = puertosDePais(puertos, paisNuevo).some((p) => etiquetaPuerto(p) === etiquetaGuardada);
  return sigue ? etiquetaGuardada : null;
}

/** ID del puerto cuya etiqueta coincide con el texto guardado (o ""). */
export function idDeEtiqueta(puertos: readonly PuertoOption[], etiqueta: string | null | undefined): string {
  if (!etiqueta) return "";
  return puertos.find((p) => etiquetaPuerto(p) === etiqueta)?.id ?? "";
}
