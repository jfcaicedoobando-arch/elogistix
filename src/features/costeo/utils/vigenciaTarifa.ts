/**
 * Lógica pura de vigencia de tarifas marítimas — extraída para reutilizar
 * entre operaciones (`TarifaEstadoUnificado`) y el portal del agente, y para
 * poder testearla sin montar componentes.
 *
 * Bug corregido: una tarifa en `estado_aprobacion='borrador'` con
 * `vigente_hasta` en el pasado se mostraba como "Pendiente" sin ninguna
 * advertencia, y el guard de aprobación no la bloqueaba.
 */
import { formatFechaDia } from "@/lib/formatters";

export type EstadoCanonicoTarifa = "Rechazada" | "Pendiente" | "Reemplazada" | "Vencida" | "Vigente";

export interface VigenciaTarifaInput {
  /** `estado_aprobacion` de la tarifa: 'borrador' | 'vigente' | 'rechazada'. */
  estadoAprobacion?: string;
  /** `estado` técnico (puede venir pre-calculado como 'reemplazada'/'vencida'). */
  estado?: string;
  /** `vigente_hasta`, date-only `YYYY-MM-DD`. */
  vigenteHasta: string;
  /** `vigente_desde`, date-only. Si es futura, la tarifa aprobada aún no aplica. */
  vigenteDesde?: string;
  /** Día de negocio México, `YYYY-MM-DD` (usar `todayLocalISO()`). */
  hoy: string;
}

export interface VigenciaTarifaResultado {
  estadoCanonico: EstadoCanonicoTarifa;
  /** `true` si `vigenteHasta < hoy`, sin importar el estado de aprobación. */
  vencida: boolean;
  /** Texto breve a mostrar cuando la tarifa está pendiente pero ya venció. */
  advertencia?: string;
  /** `true` si está aprobada pero su vigencia inicia después de `hoy`. */
  programada?: boolean;
}

/** `true` si la vigencia ya pasó (vence HOY no cuenta como vencida). */
export function esVigenciaVencida(vigenteHasta: string, hoy: string): boolean {
  return vigenteHasta < hoy;
}

/**
 * Resuelve el estado canónico de una tarifa combinando aprobación + vigencia.
 * Un borrador vencido sigue mostrándose como "Pendiente" (no cambia el flujo
 * de aprobación), pero trae `vencida: true` + `advertencia` para que la UI
 * avise y el guard de aprobación pueda bloquearla.
 */
export function resolverEstadoVigenciaTarifa(input: VigenciaTarifaInput): VigenciaTarifaResultado {
  const ap = input.estadoAprobacion ?? "vigente";
  const vencida = esVigenciaVencida(input.vigenteHasta, input.hoy);

  if (ap === "rechazada") return { estadoCanonico: "Rechazada", vencida };

  if (ap === "borrador") {
    return {
      estadoCanonico: "Pendiente",
      vencida,
      advertencia: vencida
        ? `Pendiente · vigencia vencida el ${formatFechaDia(input.vigenteHasta)}`
        : undefined,
    };
  }

  if (input.estado === "reemplazada") return { estadoCanonico: "Reemplazada", vencida };
  if (vencida || input.estado === "vencida") return { estadoCanonico: "Vencida", vencida: true };
  if (input.vigenteDesde && input.vigenteDesde > input.hoy) {
    return {
      estadoCanonico: "Vigente",
      vencida: false,
      programada: true,
      advertencia: `Aprobada · inicia ${formatFechaDia(input.vigenteDesde)}`,
    };
  }
  return { estadoCanonico: "Vigente", vencida: false };
}

/**
 * Guard de negocio: una tarifa vencida (por fecha) nunca se puede aprobar,
 * sin importar si su `estado` técnico ya se recalculó a 'vencida'.
 */
export function puedeAprobarTarifa(input: Pick<VigenciaTarifaInput, "vigenteHasta" | "hoy">): boolean {
  return !esVigenciaVencida(input.vigenteHasta, input.hoy);
}

export const MENSAJE_VIGENCIA_VENCIDA =
  "No puedes aprobar una tarifa con vigencia vencida: pide al agente actualizar la vigencia y volver a enviarla.";

/* ------------------------------------------------------------------ *
 * Fuente única para KPIs, ranking y filtro "Por vencer" del catálogo.
 * Fechas date-only `YYYY-MM-DD`: comparación léxica = cronológica, sin UTC.
 * ------------------------------------------------------------------ */
export interface TarifaVigenciaLike {
  vigente_desde?: string | null;
  vigente_hasta: string;
  estado?: string;
  estado_aprobacion?: string;
}

/** Utilizable HOY: aprobada, no reemplazada y `desde <= hoy <= hasta`. */
export function esTarifaUsableEn(t: TarifaVigenciaLike, hoy: string): boolean {
  return (t.estado_aprobacion ?? "vigente") === "vigente"
    && t.estado !== "reemplazada"
    && (t.vigente_desde ?? "") <= hoy
    && t.vigente_hasta >= hoy;
}

/** Suma días a un date-only sin pasar por UTC. */
function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/** Utilizable hoy y vence en [hoy, hoy+7]. */
export function esTarifaPorVencerEn(t: TarifaVigenciaLike, hoy: string): boolean {
  return esTarifaUsableEn(t, hoy) && t.vigente_hasta <= sumarDias(hoy, 7);
}

/** Borrador que todavía se puede aprobar (vigencia no vencida). */
export function esBorradorAprobable(t: TarifaVigenciaLike, hoy: string): boolean {
  return (t.estado_aprobacion ?? "vigente") === "borrador" && !esVigenciaVencida(t.vigente_hasta, hoy);
}

export function esBorradorVencido(t: TarifaVigenciaLike, hoy: string): boolean {
  return (t.estado_aprobacion ?? "vigente") === "borrador" && esVigenciaVencida(t.vigente_hasta, hoy);
}

export interface KpisTarifas {
  vigentes: number;
  porVencer: number;
  pendientes: number;
  borradoresVencidos: number;
  rutasCubiertas: number;
}

export function calcularKpisTarifas(
  tarifas: ReadonlyArray<TarifaVigenciaLike & { ruta_id?: string }>,
  hoy: string,
): KpisTarifas {
  const k: KpisTarifas = { vigentes: 0, porVencer: 0, pendientes: 0, borradoresVencidos: 0, rutasCubiertas: 0 };
  const rutas = new Set<string>();
  for (const t of tarifas) {
    if (esBorradorAprobable(t, hoy)) k.pendientes++;
    if (esBorradorVencido(t, hoy)) k.borradoresVencidos++;
    if (!esTarifaUsableEn(t, hoy)) continue;
    k.vigentes++;
    if (esTarifaPorVencerEn(t, hoy)) k.porVencer++;
    if (t.ruta_id) rutas.add(t.ruta_id);
  }
  k.rutasCubiertas = rutas.size;
  return k;
}

/** Búsqueda por términos: todos deben aparecer (sin contigüidad, sin acentos). */
export function normalizarBusqueda(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function coincideBusqueda(texto: string, q: string): boolean {
  const terminos = normalizarBusqueda(q).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return true;
  const hay = normalizarBusqueda(texto);
  return terminos.every((t) => hay.includes(t));
}
