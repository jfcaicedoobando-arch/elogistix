/**
 * @deprecated Movido a `@/lib/domain/estadoUnificado` en el Bloque 2.3
 * (arquitectura). Este archivo re-exporta para compatibilidad temporal;
 * imports nuevos deben apuntar directo a `lib/domain/estadoUnificado`.
 */
export {
  ESTADOS_UNIFICADOS,
  LABEL_ESTADO_UNIFICADO,
  getEstadoUnificado,
  rankEstadoUnificado,
  type EstadoUnificadoProforma,
  type ProformaEstadoInput,
} from "@/lib/domain/estadoUnificado";
