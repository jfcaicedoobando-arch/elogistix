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