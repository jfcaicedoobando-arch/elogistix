/**
 * Diff de arreglos de conceptos (costos/ventas de embarque) para bitácora.
 *
 * Extraído de `diffFields.ts` (regla Power of 10: ≤200 líneas por archivo).
 */

export interface ConceptoLike {
  concepto?: string | null;
  descripcion?: string | null;
  monto?: number | string | null;
  precio_unitario?: number | string | null;
  cantidad?: number | string | null;
  moneda?: string | null;
  proveedor_id?: string | null;
}

export interface ConceptosDiff {
  agregados: number;
  eliminados: number;
  modificados: number;
  detalle: Array<{
    tipo: "agregado" | "eliminado" | "modificado";
    concepto: string;
    antes?: string;
    despues?: string;
  }>;
}

function keyOf(c: ConceptoLike): string {
  const nombre = (c.concepto ?? c.descripcion ?? "").trim().toLowerCase();
  const prov = c.proveedor_id ?? "";
  return `${nombre}|${prov}`;
}

function montoTotal(c: ConceptoLike): number {
  if (c.monto != null) return Number(c.monto) || 0;
  const pu = Number(c.precio_unitario ?? 0) || 0;
  const qty = Number(c.cantidad ?? 1) || 1;
  return pu * qty;
}

function resumen(c: ConceptoLike): string {
  return `${montoTotal(c).toFixed(2)} ${c.moneda ?? ""}`.trim();
}

function nombreOf(c: ConceptoLike): string {
  return (c.concepto ?? c.descripcion ?? "").trim();
}

function compararConcepto(cb: ConceptoLike, ca: ConceptoLike, out: ConceptosDiff): void {
  const rb = resumen(cb);
  const ra = resumen(ca);
  if (rb === ra && (cb.moneda ?? "") === (ca.moneda ?? "")) return;
  out.modificados += 1;
  out.detalle.push({ tipo: "modificado", concepto: nombreOf(ca), antes: rb, despues: ra });
}

function agruparPorClave(lista: ConceptoLike[] | null | undefined): Map<string, ConceptoLike[]> {
  const out = new Map<string, ConceptoLike[]>();
  for (const c of lista ?? []) {
    const k = keyOf(c);
    const bucket = out.get(k);
    if (bucket) bucket.push(c);
    else out.set(k, [c]);
  }
  return out;
}

function diffBucket(antes: ConceptoLike[], despues: ConceptoLike[], out: ConceptosDiff): void {
  const comunes = Math.min(antes.length, despues.length);
  for (let i = 0; i < comunes; i += 1) compararConcepto(antes[i], despues[i], out);
  for (let i = comunes; i < despues.length; i += 1) {
    out.agregados += 1;
    out.detalle.push({
      tipo: "agregado",
      concepto: nombreOf(despues[i]),
      despues: resumen(despues[i]),
    });
  }
  for (let i = comunes; i < antes.length; i += 1) {
    out.eliminados += 1;
    out.detalle.push({ tipo: "eliminado", concepto: nombreOf(antes[i]), antes: resumen(antes[i]) });
  }
}

/**
 * Compara dos listas de conceptos (venta o costo) y devuelve un resumen
 * cuantitativo + detalle de cambios. Empareja por (concepto, proveedor_id).
 *
 * Se agrupa por clave en listas y no en un `Map` de un solo elemento: un
 * embarque puede tener varios conceptos con el mismo nombre y proveedor (p. ej.
 * dos "Demoras"), y al colapsarlos la bitácora reportaba 1 eliminado cuando en
 * realidad se habían quitado 2.
 */
export function diffConceptos(
  before: ConceptoLike[] | null | undefined,
  after: ConceptoLike[] | null | undefined,
): ConceptosDiff {
  const mapBefore = agruparPorClave(before);
  const mapAfter = agruparPorClave(after);
  const out: ConceptosDiff = { agregados: 0, eliminados: 0, modificados: 0, detalle: [] };

  for (const [k, despues] of mapAfter) {
    diffBucket(mapBefore.get(k) ?? [], despues, out);
  }
  for (const [k, antes] of mapBefore) {
    if (mapAfter.has(k)) continue;
    diffBucket(antes, [], out);
  }
  return out;
}
