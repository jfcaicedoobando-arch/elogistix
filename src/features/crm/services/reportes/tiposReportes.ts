/**
 * Tipos y catálogos de los reportes dinámicos del CRM (Fase 7).
 * Las agrupaciones y medidas válidas están fijadas también en la base
 * (CHECK de `crm_reportes`): este catálogo es su espejo para la pantalla.
 */

export type ObjetoReporte = "empresa" | "oportunidad" | "actividad" | "solicitud_pricing";
export type MedidaReporte = "conteo" | "suma_monto_usd";
export type TipoGrafica = "barras" | "linea" | "pastel" | "numero" | "tabla";

export interface FiltroReporte {
  desde?: string;
  hasta?: string;
  etapaId?: string;
  vendedor?: string;
}

export interface CrmTableroRow {
  id: string;
  organization_id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

export interface CrmReporteRow {
  id: string;
  tablero_id: string;
  organization_id: string;
  nombre: string;
  objeto: ObjetoReporte;
  medida: MedidaReporte;
  agrupacion: string;
  filtro: FiltroReporte;
  tipo_grafica: TipoGrafica;
  posicion: number;
}

export interface ReporteDato {
  etiqueta: string;
  valor: number;
}

export const OBJETOS_REPORTE: { valor: ObjetoReporte; etiqueta: string }[] = [
  { valor: "empresa", etiqueta: "Empresas" },
  { valor: "oportunidad", etiqueta: "Oportunidades" },
  { valor: "actividad", etiqueta: "Actividades" },
  { valor: "solicitud_pricing", etiqueta: "Solicitudes a Pricing" },
];

export const AGRUPACIONES: Record<ObjetoReporte, { valor: string; etiqueta: string }[]> = {
  empresa: [
    { valor: "puntaje", etiqueta: "Puntaje (A/B/C)" },
    { valor: "mes", etiqueta: "Mes de alta" },
  ],
  oportunidad: [
    { valor: "etapa", etiqueta: "Etapa" },
    { valor: "vendedor", etiqueta: "Vendedor" },
    { valor: "modo", etiqueta: "Modo de transporte" },
    { valor: "puntaje", etiqueta: "Puntaje (A/B/C)" },
    { valor: "mes", etiqueta: "Mes de creación" },
  ],
  actividad: [
    { valor: "tipo", etiqueta: "Tipo de actividad" },
    { valor: "responsable", etiqueta: "Responsable" },
    { valor: "mes", etiqueta: "Mes" },
  ],
  solicitud_pricing: [
    { valor: "estado", etiqueta: "Estado" },
    { valor: "complejidad", etiqueta: "Complejidad" },
    { valor: "servicio", etiqueta: "Servicio" },
    { valor: "mes", etiqueta: "Mes" },
  ],
};

export const MEDIDAS_REPORTE: { valor: MedidaReporte; etiqueta: string; soloOportunidad?: boolean }[] = [
  { valor: "conteo", etiqueta: "Número de registros" },
  { valor: "suma_monto_usd", etiqueta: "Suma del monto estimado (USD)", soloOportunidad: true },
];

export const TIPOS_GRAFICA: { valor: TipoGrafica; etiqueta: string }[] = [
  { valor: "barras", etiqueta: "Barras" },
  { valor: "linea", etiqueta: "Línea" },
  { valor: "pastel", etiqueta: "Pastel" },
  { valor: "numero", etiqueta: "Número grande" },
  { valor: "tabla", etiqueta: "Tabla" },
];

/** Lee el filtro guardado en JSON (defensivo ante llaves faltantes). */
export function filtroDesdeJson(raw: unknown): FiltroReporte {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
  return {
    desde: texto(r.desde),
    hasta: texto(r.hasta),
    etapaId: texto(r.etapa_id),
    vendedor: texto(r.vendedor),
  };
}

/** Convierte el filtro de pantalla al JSON que espera la base. */
export function filtroAJson(f: FiltroReporte): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.desde) out.desde = f.desde;
  if (f.hasta) out.hasta = f.hasta;
  if (f.etapaId) out.etapa_id = f.etapaId;
  if (f.vendedor) out.vendedor = f.vendedor;
  return out;
}

/** Validación previa a guardar; devuelve el mensaje de error o null. */
export function validarReporte(input: {
  nombre: string;
  objeto: ObjetoReporte;
  medida: MedidaReporte;
  agrupacion: string;
}): string | null {
  if (input.nombre.trim() === "") return "El reporte necesita un nombre.";
  if (!AGRUPACIONES[input.objeto].some((a) => a.valor === input.agrupacion)) {
    return "Esa agrupación no aplica para el objeto elegido.";
  }
  if (input.medida === "suma_monto_usd" && input.objeto !== "oportunidad") {
    return "La suma de montos solo aplica para Oportunidades.";
  }
  return null;
}
