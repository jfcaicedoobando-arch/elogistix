/**
 * Similitud de descripción (Sørensen–Dice sobre bigramas de caracteres)
 * y cercanía de monto para el motor de matching factura ↔ conceptos_costo.
 */
import { normalizarTexto } from "./normalizarTexto";

function bigrams(s: string): string[] {
  const clean = s.replace(/\s+/g, "");
  if (clean.length < 2) return clean ? [clean] : [];
  const out: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice sobre bigramas de la descripción normalizada. Devuelve 0..1. */
export function similitudDescripcion(a: string, b: string): number {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  if (ba.length === 0 || bb.length === 0) return 0;
  const setB = new Map<string, number>();
  for (const g of bb) setB.set(g, (setB.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of ba) {
    const c = setB.get(g) ?? 0;
    if (c > 0) { inter++; setB.set(g, c - 1); }
  }
  return (2 * inter) / (ba.length + bb.length);
}

/**
 * Cercanía de monto: 1.0 cuando |Δ|/max ≤ 5%, decae linealmente y llega a 0 en 25%.
 * Fórmula: max(0, 1 - (|a-b|/max(a,b)) * 4).
 */
export function cercaniaMonto(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return 0;
  const diff = Math.abs(a - b);
  const rel = diff / Math.max(a, b);
  return Math.max(0, 1 - rel * 4);
}

export interface ScoreArgs {
  descripcionA: string;
  descripcionB: string;
  montoA: number;
  montoB: number;
  monedaA: string;
  monedaB: string;
}

/** Score compuesto 0..1 (con penalización dura si las monedas difieren). */
export function scoreCompuesto(a: ScoreArgs): number {
  const sim = similitudDescripcion(a.descripcionA, a.descripcionB);
  const cerc = cercaniaMonto(a.montoA, a.montoB);
  let s = 0.6 * sim + 0.4 * cerc;
  if (a.monedaA && a.monedaB && a.monedaA !== a.monedaB) s -= 0.5;
  return Math.max(0, Math.min(1, s));
}
