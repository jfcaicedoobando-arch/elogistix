/**
 * Helpers puros: puertos de origen/destino que tienen una ruta marítima
 * activa dada de alta en Costeo → Rutas.
 */
import type { PuertoOption } from "@/features/catalogos";

export interface RutaPuertos {
  puerto_origen_id: string;
  puerto_destino_id: string;
  activa?: boolean | null;
}

const activas = (rutas: RutaPuertos[]) => rutas.filter((r) => r.activa !== false);

export function origenesDeRutas(rutas: RutaPuertos[], catalogo: PuertoOption[]): PuertoOption[] {
  const ids = new Set(activas(rutas).map((r) => r.puerto_origen_id));
  return catalogo.filter((p) => ids.has(p.id));
}

export function destinosDeOrigen(
  rutas: RutaPuertos[], catalogo: PuertoOption[], origenId: string,
): PuertoOption[] {
  if (!origenId) return [];
  const ids = new Set(
    activas(rutas).filter((r) => r.puerto_origen_id === origenId).map((r) => r.puerto_destino_id),
  );
  return catalogo.filter((p) => ids.has(p.id));
}
