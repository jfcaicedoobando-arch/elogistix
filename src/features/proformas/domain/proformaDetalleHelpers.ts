/**
 * Helpers puros para la vista de detalle de proforma.
 * Reutilizados también por el PDF (`src/pdf/documents/ProformaHeader.tsx`)
 * para evitar duplicación de reglas.
 */
import { formatDate } from "@/lib/formatters";

export function vigenciaPlus30(fechaEmision: string | null | undefined): string {
  if (!fechaEmision) return "—";
  try {
    const d = new Date(fechaEmision);
    d.setDate(d.getDate() + 30);
    return formatDate(d.toISOString().substring(0, 10));
  } catch {
    return "—";
  }
}

export interface ContenedorLite {
  numero_contenedor: string;
  tipo_contenedor: string | null;
}

export function resumirContenedores(contenedores: ContenedorLite[]): string {
  if (contenedores.length === 0) return "";
  if (contenedores.length <= 3) {
    return contenedores
      .map((c) => `${c.numero_contenedor}${c.tipo_contenedor ? ` · ${c.tipo_contenedor}` : ""}`)
      .join(", ");
  }
  const tipos = new Map<string, number>();
  for (const c of contenedores) {
    const t = c.tipo_contenedor || "—";
    tipos.set(t, (tipos.get(t) ?? 0) + 1);
  }
  const resumen = Array.from(tipos.entries())
    .map(([t, n]) => `${n} × ${t}`)
    .join(" + ");
  const numeros = contenedores.map((c) => c.numero_contenedor).join(", ");
  return `${resumen} — ${numeros}`;
}

/** Prioridad Port > Airport > City (memoria de proyecto). */
export function resolverUbicacion(
  puerto: string | null | undefined,
  aeropuerto: string | null | undefined,
  ciudad: string | null | undefined,
): string {
  return puerto?.trim() || aeropuerto?.trim() || ciudad?.trim() || "—";
}

export interface DiasCreditoResuelto {
  /** Días efectivos a usar (proforma > cliente > null). */
  dias: number | null;
  /** `true` cuando el valor proviene del catálogo de clientes. */
  heredado: boolean;
}

/**
 * Resuelve los días de crédito de una proforma: usa el valor capturado en la
 * proforma y, si no existe, hereda el del cliente marcando el origen para que
 * la UI pueda mostrar el badge "Heredado del cliente".
 */
export function resolverDiasCredito(
  diasProforma: number | null | undefined,
  diasCliente: number | null | undefined,
): DiasCreditoResuelto {
  if (typeof diasProforma === "number" && Number.isFinite(diasProforma)) {
    return { dias: diasProforma, heredado: false };
  }
  if (typeof diasCliente === "number" && Number.isFinite(diasCliente)) {
    return { dias: diasCliente, heredado: true };
  }
  return { dias: null, heredado: false };
}

export interface EnvioLite {
  created_at: string;
  estado?: string | null;
}

export interface ResumenEnvios {
  total: number;
  ultimoAt: string | null;
}

/** Resume los envíos por correo de una proforma (total + fecha del último). */
export function resumirEnvios(envios: EnvioLite[] | null | undefined): ResumenEnvios {
  const lista = envios ?? [];
  if (lista.length === 0) return { total: 0, ultimoAt: null };
  const ultimo = lista.reduce((max, e) => (e.created_at > max ? e.created_at : max), lista[0].created_at);
  return { total: lista.length, ultimoAt: ultimo };
}
