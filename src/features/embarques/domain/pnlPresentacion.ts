interface ContenedorPresentacion {
  numero_contenedor?: string | null;
  deleted_at?: string | null;
}

interface ConceptoMoneda {
  moneda?: string | null;
  deleted_at?: string | null;
}

/** Un marcador vacío todavía no representa un contenedor operativo. */
export function tieneContenedorOperativo(
  contenedores: readonly ContenedorPresentacion[],
): boolean {
  return contenedores.some(
    (contenedor) =>
      !contenedor.deleted_at && Boolean(contenedor.numero_contenedor?.trim()),
  );
}

/** Monedas extranjeras presentes en conceptos financieros activos. */
export function monedasExtranjerasActivas(
  ventas: readonly ConceptoMoneda[],
  costos: readonly ConceptoMoneda[],
): string[] {
  const monedas = new Set<string>();
  for (const concepto of [...ventas, ...costos]) {
    const moneda = concepto.moneda?.trim().toUpperCase();
    if (!concepto.deleted_at && moneda && moneda !== "MXN") monedas.add(moneda);
  }
  return [...monedas].sort();
}