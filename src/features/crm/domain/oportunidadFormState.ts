/**
 * Tipos y valor vacío del formulario de Oportunidad CRM.
 * Separado del hook para evitar ciclos y mantener Power of 10.
 */
import type { Moneda } from "@/features/crm/types/oportunidades";

export interface OportunidadFormState {
  nombre: string;
  cliente_id: string | null;
  cliente_nombre: string;
  etapa_id: string;
  monto_estimado: number;
  moneda: Moneda;
  probabilidad: number;
  // B-034: captura al cerrar en etapa "ganada".
  valor_real: number;
  fecha_cierre_real: string;
  fecha_estimada_cierre: string;
  modo: string;
  origen: string;
  destino: string;
  notas: string;
  vendedor_id: string | null;
  vendedor_email: string;
}

export const EMPTY_OPORTUNIDAD: OportunidadFormState = {
  nombre: "",
  cliente_id: null,
  cliente_nombre: "",
  etapa_id: "",
  monto_estimado: 0,
  moneda: "MXN",
  probabilidad: 0,
  valor_real: 0,
  fecha_cierre_real: "",
  fecha_estimada_cierre: "",
  modo: "",
  origen: "",
  destino: "",
  notas: "",
  vendedor_id: null,
  vendedor_email: "",
};
