/**
 * Escala de severidad por días vencidos (tokens `aging-1..5`).
 * Fuente única para pintar los días en listas de cartera.
 */
export function agingNivel(dias?: number | null): 1 | 2 | 3 | 4 | 5 {
  const d = dias ?? 0;
  if (d <= 15) return 1;
  if (d <= 30) return 2;
  if (d <= 60) return 3;
  if (d <= 90) return 4;
  return 5;
}

const CLASES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "text-aging-1",
  2: "text-aging-2",
  3: "text-aging-3",
  4: "text-aging-4",
  5: "text-aging-5",
};

/** Clase de color de texto para los días vencidos. */
export function agingTextClass(dias?: number | null): string {
  return CLASES[agingNivel(dias)];
}
