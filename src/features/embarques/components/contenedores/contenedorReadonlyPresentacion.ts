interface ContenedorCaptura {
  numero_contenedor?: string | null;
  peso_kg?: number | string | null;
  volumen_m3?: number | string | null;
  piezas?: number | null;
}

export function esMarcadorContenedor(contenedor: ContenedorCaptura): boolean {
  return !contenedor.numero_contenedor?.trim();
}

export function valorCargaCapturada(
  contenedor: ContenedorCaptura,
  campo: "peso_kg" | "volumen_m3" | "piezas",
): number | null {
  if (esMarcadorContenedor(contenedor)) return null;
  const valor = Number(contenedor[campo]);
  return Number.isFinite(valor) ? valor : null;
}

export function mostrarColumnaCarga(uniforme: boolean, pendientes: number): boolean {
  return pendientes > 0 || !uniforme;
}

export function valoresUniformes<T>(valores: T[]): boolean {
  if (valores.length <= 1) return false;
  const primero = String(valores[0]);
  return valores.every((valor) => String(valor) === primero);
}

export function mostrarResumenUniforme(
  pendientes: number,
  uniformes: readonly boolean[],
): boolean {
  return pendientes === 0 && uniformes.some(Boolean);
}