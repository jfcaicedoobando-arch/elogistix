/**
 * Traducción pura de los eventos de bitácora al lenguaje del expediente de
 * refacturación: etiqueta en español, paso al que pertenece y si es un fallo.
 * Sin React ni red, para poder probarse en aislamiento.
 */
import type { RefacturacionEventoRaw } from "@/features/facturacion/services/refacturacionExpediente";

export type SeveridadEvento = "ok" | "pendiente" | "error";

export interface EventoRefacturacion {
  id: string;
  ts: string;
  titulo: string;
  paso: number | null;
  severidad: SeveridadEvento;
  usuarioEmail: string;
  referencia: string;
}

interface Regla {
  titulo: string;
  paso: number | null;
  severidad: SeveridadEvento;
}

const REGLAS: Record<string, Regla> = {
  refacturacion_abierta: { titulo: "Caso de refacturación abierto", paso: 1, severidad: "ok" },
  facturapi_rep_cancelacion_solicitada: {
    titulo: "Cancelación del REP solicitada al SAT", paso: 2, severidad: "pendiente",
  },
  facturapi_rep_cancelado: { titulo: "REP cancelado", paso: 2, severidad: "ok" },
  facturapi_rep_cancelar_failed: { titulo: "Error al cancelar el REP", paso: 2, severidad: "error" },
  facturapi_rep_cancelacion_rechazada: {
    titulo: "El SAT rechazó la cancelación del REP", paso: 2, severidad: "error",
  },
  refacturacion_borrador_creado: {
    titulo: "Borrador de la nueva factura creado", paso: 3, severidad: "ok",
  },
  timbrar_factura: { titulo: "Timbrado solicitado", paso: 3, severidad: "pendiente" },
  facturapi_emitida: { titulo: "Nueva factura timbrada", paso: 3, severidad: "ok" },
  actualizar_datos_timbrado_factura: {
    titulo: "Datos fiscales de timbrado actualizados", paso: 3, severidad: "ok",
  },
  facturapi_cancelacion_solicitada: {
    titulo: "Cancelación de la factura original solicitada", paso: 4, severidad: "pendiente",
  },
  facturapi_cancelada: { titulo: "Factura original cancelada", paso: 4, severidad: "ok" },
  facturapi_cancelada_async: {
    titulo: "Cancelación de la factura original confirmada por el SAT", paso: 4, severidad: "ok",
  },
  facturapi_cancelar_failed: {
    titulo: "Error al cancelar la factura original", paso: 4, severidad: "error",
  },
  refacturacion_pago_reasignado: {
    titulo: "Pago reasignado a la nueva factura", paso: 5, severidad: "ok",
  },
  registrar_pago: { titulo: "Pago registrado", paso: 5, severidad: "ok" },
  facturapi_rep_emitido: { titulo: "Nuevo REP timbrado", paso: 5, severidad: "ok" },
  facturapi_rep_emitir_failed: { titulo: "Error al timbrar el nuevo REP", paso: 5, severidad: "error" },
  factura_enviada_email: { titulo: "Factura enviada por correo", paso: null, severidad: "ok" },
  refacturacion_completada: { titulo: "Caso completado", paso: 5, severidad: "ok" },
  refacturacion_cancelada: { titulo: "Caso cancelado sin concluir", paso: null, severidad: "error" },
};

function tituloGenerico(accion: string): string {
  const limpio = accion.replace(/[._]/g, " ").trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Convierte un renglón de bitácora en un evento legible del expediente. */
export function mapearEvento(raw: RefacturacionEventoRaw): EventoRefacturacion {
  const regla = REGLAS[raw.accion];
  return {
    id: raw.id,
    ts: raw.ts,
    titulo: regla?.titulo ?? tituloGenerico(raw.accion),
    paso: regla?.paso ?? null,
    severidad: regla?.severidad ?? "ok",
    usuarioEmail: raw.usuarioEmailFallback(),
    referencia: raw.entidad_nombre ?? "",
  } as EventoRefacturacion;
}
