import type { FacturaRefacturacion } from "./refacturacionEstadoFiscal";

export type EstadoFacturaNueva =
  | "sin_referencia" | "verificando" | "error" | "ausente"
  | "eliminada" | "desconocida" | "vigente";

interface Lectura {
  casoDisponible: boolean;
  casoCargando: boolean;
  casoError: boolean;
  facturaNuevaId: string | null | undefined;
  factura: FacturaRefacturacion | null | undefined;
  cargando: boolean;
  error: boolean;
}

/** Un fetch en curso nunca oculta una baja, ausencia o error ya observados. */
function impedimentoConocido(lectura: Lectura): EstadoFacturaNueva | null {
  if (lectura.casoError) return "error";
  if (!lectura.facturaNuevaId) return null;
  if (lectura.error) return "error";
  if (lectura.factura === null) return "ausente";
  if (!lectura.factura) return null;
  if (lectura.factura.id !== lectura.facturaNuevaId) return "desconocida";
  if (lectura.factura.deleted_at === undefined) return "desconocida";
  return lectura.factura.deleted_at === null ? null : "eliminada";
}

/** Un null del lector no equivale a un caso sin factura_nueva_id. */
export function estadoFacturaNueva(lectura: Lectura): EstadoFacturaNueva {
  const impedimento = impedimentoConocido(lectura);
  if (impedimento) return impedimento;
  if (lectura.casoCargando || lectura.cargando) return "verificando";
  if (!lectura.casoDisponible) return "verificando";
  if (lectura.facturaNuevaId === undefined) return "desconocida";
  if (lectura.facturaNuevaId === null) return "sin_referencia";
  // undefined es una consulta aún no resuelta; null es ausencia confirmada.
  return lectura.factura === undefined ? "verificando" : "vigente";
}

const BLOQUEOS: Record<EstadoFacturaNueva, string | null> = {
  sin_referencia: null,
  vigente: null,
  verificando: "Verificando la referencia y vigencia de la nueva factura…",
  error: "No se pudo verificar la nueva factura. Actualiza el estado antes de continuar.",
  ausente: "El caso tiene una factura nueva vinculada, pero no está disponible para consulta. No se puede crear otro borrador.",
  eliminada: "La nueva factura está dada de baja. Se conserva su referencia histórica; las operaciones del caso están bloqueadas.",
  desconocida: "No se pudo confirmar la vigencia de la nueva factura. Actualiza el estado antes de continuar.",
};

export function bloqueoFacturaNueva(estado: EstadoFacturaNueva): string | null {
  return BLOQUEOS[estado];
}
