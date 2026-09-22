/**
 * Helpers puros del selector de puertos por ID (etiqueta y filtro de búsqueda).
 */
export interface PuertoOption {
  id: string;
  code: string;
  name: string;
  country: string;
  activo?: boolean | null;
}

export function etiquetaPuerto(p: PuertoOption): string {
  return `${p.name}, ${p.country} (${p.code})`;
}

export function filtrarPuertos(puertos: PuertoOption[], query: string): PuertoOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return puertos;
  return puertos.filter((p) =>
    `${p.name} ${p.country} ${p.code}`.toLowerCase().includes(q),
  );
}
