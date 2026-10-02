/**
 * Reloj de respuesta de Pricing: puro, sin fechas implícitas (recibe `ahora`).
 * Amarillo cuando queda ≤25 % del plazo; rojo al vencer.
 */
export type NivelReloj = "ok" | "alerta" | "vencida" | "detenida";

export interface EstadoReloj { nivel: NivelReloj; minutos: number; texto: string }

function formatoDuracion(min: number): string {
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h} h ${r} min` : `${r} min`;
}

export function calcularReloj(input: {
  enviadaAt: string | null; venceAt: string | null; respondidaAt: string | null; ahora: Date;
}): EstadoReloj | null {
  if (!input.enviadaAt || !input.venceAt) return null;
  const inicio = new Date(input.enviadaAt).getTime();
  const vence = new Date(input.venceAt).getTime();
  if (input.respondidaAt) {
    const fin = new Date(input.respondidaAt).getTime();
    const min = (fin - inicio) / 60_000;
    const tarde = fin > vence;
    return { nivel: "detenida", minutos: min, texto: `Respondida en ${formatoDuracion(min)}${tarde ? " (fuera de tiempo)" : ""}` };
  }
  const restante = (vence - input.ahora.getTime()) / 60_000;
  if (restante <= 0) return { nivel: "vencida", minutos: restante, texto: `Vencida hace ${formatoDuracion(restante)}` };
  const plazo = (vence - inicio) / 60_000;
  const nivel: NivelReloj = restante <= plazo * 0.25 ? "alerta" : "ok";
  return { nivel, minutos: restante, texto: `Quedan ${formatoDuracion(restante)}` };
}
