/**
 * Helpers puros para leer los campos "extra" de proforma que aún no están en
 * los tipos generados (`estado_cliente`, `aceptada_por`, `enviada_at`, etc.).
 * Concentra en un único lugar el cast requerido y devuelve valores ya
 * normalizados a los componentes de presentación.
 */
import type { ProformaDetalleFull } from "@/features/proformas/services";

// SAFE-CAST: columnas nuevas aún no presentes en los tipos generados; el
// helper aísla el cast para que el resto del código consuma valores tipados.
type ExtraFields = {
  estado_cliente?: string | null;
  aceptada_por?: string | null;
  enviada_at?: string | null;
  enviada_por?: string | null;
  aceptada_at?: string | null;
  rechazada_at?: string | null;
  fecha_facturacion?: string | null;
};

export type EstadoClienteProforma = "pendiente" | "aceptada" | "rechazada";

export interface ProformaTimelineFields {
  estadoCliente: EstadoClienteProforma;
  aceptadaPor: string | null;
  enviadaAt: string | null;
  enviadaPor: string | null;
  aceptadaAt: string | null;
  rechazadaAt: string | null;
  fechaFacturacion: string | null;
}

export function resolveEstadoCliente(raw: string | null | undefined): EstadoClienteProforma {
  return raw === "aceptada" || raw === "rechazada" ? raw : "pendiente";
}

export function resolveProformaTimelineFields(proforma: ProformaDetalleFull): ProformaTimelineFields {
  // SAFE-CAST: única frontera; ver ExtraFields arriba.
  const extra = proforma as unknown as ExtraFields;
  return {
    estadoCliente: resolveEstadoCliente(extra.estado_cliente),
    aceptadaPor: extra.aceptada_por ?? null,
    enviadaAt: extra.enviada_at ?? null,
    enviadaPor: extra.enviada_por ?? null,
    aceptadaAt: extra.aceptada_at ?? null,
    rechazadaAt: extra.rechazada_at ?? null,
    fechaFacturacion: extra.fecha_facturacion ?? null,
  };
}
