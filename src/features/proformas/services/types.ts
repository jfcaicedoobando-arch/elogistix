import type { Tables } from "@/integrations/supabase/types";

export type ProformaRow = Tables<"proformas">;
export type ConceptoVentaRow = Tables<"conceptos_venta">;
export type ProformaConceptoConsolidadoRow = Tables<"proforma_conceptos_consolidados">;

export type ProformaConFactura = ProformaRow & {
  facturas: { factura_pdf_url: string | null; factura_xml_url: string | null } | null;
  /**
   * R170-01: facturas reales asociadas (FK inversa `facturas.proforma_id`),
   * usadas SÓLO para distinguir en la lista una conversión a factura
   * BORRADOR (sin UUID fiscal) de una emisión real, vía
   * `etiquetaCicloProforma.ts`. Ya viene filtrada de `deleted_at` en el
   * cliente. Opcional porque no todos los selects la traen (p.ej. el select
   * del embarque no la necesita).
   */
  facturas_asociadas?: ProformaFacturaAsociadaLite[];
};

/** Forma mínima de una factura asociada para la etiqueta de la lista (ver arriba). */
export type ProformaFacturaAsociadaLite = {
  id: string;
  estado: string | null;
  uuid_fiscal: string | null;
  deleted_at: string | null;
};

/**
 * Forma derivada en cliente (no es columna DB): lista única de los contenedores
 * reales (hijos) a los que apunta esta proforma, calculada en `fetchProformasPendientes`
 * a partir de los `conceptos_venta.contenedor_id` → `embarque_contenedores`.
 * Permite agrupar correctamente embarques con N contenedores en lugar de depender
 * del campo legacy `embarques.contenedor`.
 */
export interface ContenedorRef {
  numero: string | null;
  tipo: string | null;
}

export type ProformaPendienteConEmbarque = ProformaRow & {
  embarques: {
    expediente: string;
    bl_master: string | null;
    cliente_nombre: string;
    contenedor: string | null;
    tipo_contenedor: string | null;
  } | null;
  contenedores_lista?: ContenedorRef[];
};

// ---- Detalle full (usado por fetchProformaPorId / PDF / vista detalle) ----

export type ProformaClienteFull = {
  nombre: string | null;
  rfc: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  cp: string | null;
  /** Días de crédito pactados en el catálogo de clientes (fallback). */
  dias_credito?: number | null;
};

export type ProformaEmbarqueFull = {
  modo: string | null;
  tipo: string | null;
  incoterm: string | null;
  bl_house: string | null;
  puerto_origen: string | null;
  puerto_destino: string | null;
  aeropuerto_origen: string | null;
  aeropuerto_destino: string | null;
  ciudad_origen: string | null;
  ciudad_destino: string | null;
  descripcion_mercancia: string | null;
  contenedores: Array<{ numero_contenedor: string; tipo_contenedor: string | null }> | null;
};

export type ProformaFacturaAsociada = {
  id: string;
  numero: string | null;
  estado: string;
  total: number;
  moneda: string;
  fecha_emision: string | null;
  uuid_fiscal: string | null;
  factura_pdf_url: string | null;
  factura_xml_url: string | null;
};

/** Envío por correo registrado en `proforma_envios` (forma reducida). */
export type ProformaEnvioLite = {
  created_at: string;
  estado: string | null;
  destinatarios: unknown;
};

export type ProformaDetalleFull = Omit<ProformaConFactura, "facturas_asociadas"> & {
  /**
   * Factura(s) generadas a partir de esta proforma. Se resuelve vía la FK
   * inversa `facturas.proforma_id → proformas.id` porque el flujo de
   * conversión "un clic" puede producir varias facturas (una por moneda —
   * el SAT no permite CFDI multi-moneda) y ya no llena `proformas.factura_id`.
   */
  facturas_asociadas: ProformaFacturaAsociada[];
  cliente_full: ProformaClienteFull | null;
  embarque_full: ProformaEmbarqueFull | null;
  /** Envíos al cliente, más reciente primero. */
  envios: ProformaEnvioLite[];
};
