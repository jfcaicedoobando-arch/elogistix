/**
 * Etapa 2 — identidad inequívoca de puertos (única utilidad de presentación).
 *
 * Regla: el nombre es la línea principal; país y UN/LOCODE son contexto.
 * Formato completo: "Rotterdam, Países Bajos (NLRTM)".
 * Si `code` o `country` vienen nulos/legacy NUNCA se imprime "null",
 * "undefined", comas sueltas ni paréntesis vacíos.
 *
 * No duplicar estas concatenaciones en componentes: importar desde aquí.
 */

export interface PuertoIdentidad {
  nombre?: string | null;
  code?: string | null;
  country?: string | null;
}

/** Fila que transporta identidad de puertos (vista/tabla/RPC de tarifas o rutas). */
export interface FilaConPuertos {
  puerto_origen_nombre?: string | null;
  puerto_origen_code?: string | null;
  puerto_origen_country?: string | null;
  puerto_destino_nombre?: string | null;
  puerto_destino_code?: string | null;
  puerto_destino_country?: string | null;
}

const SIN_DATO = "—";

function limpio(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

export function origenDe(r: FilaConPuertos): PuertoIdentidad {
  return {
    nombre: r.puerto_origen_nombre,
    code: r.puerto_origen_code,
    country: r.puerto_origen_country,
  };
}

export function destinoDe(r: FilaConPuertos): PuertoIdentidad {
  return {
    nombre: r.puerto_destino_nombre,
    code: r.puerto_destino_code,
    country: r.puerto_destino_country,
  };
}

/** Sólo el nombre (línea principal), con guion largo si no hay dato. */
export function nombrePuerto(p: PuertoIdentidad): string {
  return limpio(p.nombre) || SIN_DATO;
}

/** "Rotterdam, Países Bajos (NLRTM)" con degradación limpia. */
export function etiquetaPuertoCompleta(p: PuertoIdentidad): string {
  const nombre = limpio(p.nombre);
  const country = limpio(p.country);
  const code = limpio(p.code);
  if (!nombre) return code || country || SIN_DATO;
  const conPais = country ? `${nombre}, ${country}` : nombre;
  return code ? `${conPais} (${code})` : conPais;
}

/** Contexto secundario para tablas: "Países Bajos · NLRTM" (vacío si no hay datos). */
export function contextoPuerto(p: PuertoIdentidad): string {
  const partes = [limpio(p.country), limpio(p.code)].filter(Boolean);
  return partes.join(" · ");
}

/** "Rotterdam → Veracruz" (línea principal de ruta). */
export function rutaCorta(origen: PuertoIdentidad, destino: PuertoIdentidad): string {
  return `${nombrePuerto(origen)} → ${nombrePuerto(destino)}`;
}

/** "Rotterdam, Países Bajos (NLRTM) → Veracruz, México (MXVER)". */
export function etiquetaRutaCompleta(origen: PuertoIdentidad, destino: PuertoIdentidad): string {
  return `${etiquetaPuertoCompleta(origen)} → ${etiquetaPuertoCompleta(destino)}`;
}

/** Contexto de ruta para texto secundario; vacío si ningún lado aporta datos. */
export function contextoRuta(origen: PuertoIdentidad, destino: PuertoIdentidad): string {
  const a = contextoPuerto(origen);
  const b = contextoPuerto(destino);
  if (!a && !b) return "";
  return `${a || SIN_DATO} → ${b || SIN_DATO}`;
}

/**
 * Texto normalizado para búsquedas locales: encuentra por nombre, país o
 * UN/LOCODE de origen y destino.
 */
export function textoBusquedaPuertos(r: FilaConPuertos): string {
  const o = origenDe(r);
  const d = destinoDe(r);
  return [o.nombre, o.country, o.code, d.nombre, d.country, d.code]
    .map((v) => limpio(v))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
