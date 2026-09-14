/**
 * O8 (auditoría 2026-07-29): selects explícitos por caso de uso.
 * C27 (v13.823.381): extraídos de `queries.ts` para respetar el límite de
 * tamaño de archivo (Power of 10). Contratos y columnas sin cambios.
 *
 * PROFORMA_LISTA_SELECT cubre la bandeja unificada `/proformas`
 * (TabProformas + filtros + CSV). PROFORMA_EMBARQUE_SELECT cubre el tab de
 * facturación del embarque. Si una pantalla necesita otra columna,
 * añadirla aquí con su consumidor en el comentario — no volver a `*`.
 */

/** Embed reducido de una factura vinculada (etiqueta del ciclo documental). */
const FACTURA_LITE = "id, estado, uuid_fiscal, deleted_at";

export const PROFORMA_LISTA_SELECT = [
  "id", "numero", "expediente", "embarque_id", "cliente_id", "cliente_nombre", "operador",
  // C25: `es_consolidada` y `estado_revision` los usa `useTabProformasController`
  // para no permitir seleccionar una proforma fuente ya consolidada ni mezclar
  // consolidadas con individuales en una fusión.
  "es_consolidada", "estado_revision",
  "dias_credito", "organization_id",
  "subtotal_usd", "iva_usd", "total_usd", "subtotal_mxn", "iva_mxn", "total_mxn",
  "fecha_emision", "estado_proforma", "estado_cliente", "folio_factura_externa",
  "fecha_facturacion", "factura_id", "factura_secundaria_id", "created_at",
  "facturas:factura_id(factura_pdf_url, factura_xml_url)",
  // R170-01: facturas reales (FK inversa), sólo para distinguir en la lista
  // una conversión a factura BORRADOR de una emisión fiscal real (ver
  // `etiquetaCicloProforma.ts`). Se filtran las borradas (`deleted_at`) en
  // cliente, igual que hace `fetchProformaPorId`.
  "facturas_asociadas:facturas!proforma_id(" + FACTURA_LITE + ")",
  // C30 (v13.823.381): en una fusión de VARIAS proformas las facturas quedan
  // con `proforma_id = NULL` (una factura, N proformas). El vínculo vive en
  // `proformas.factura_id` / `factura_secundaria_id`; sin estos embeds la
  // lista perdía la etiqueta y el acceso al documento.
  "factura_vinculada:factura_id(" + FACTURA_LITE + ")",
  "factura_vinculada_secundaria:factura_secundaria_id(" + FACTURA_LITE + ")",
].join(", ");

export const PROFORMA_EMBARQUE_SELECT = [
  "id", "numero", "embarque_id", "factura_id", "factura_secundaria_id",
  "estado_proforma", "estado_revision", "estado_aprobacion", "estado_cliente",
  "motivo_rechazo", "rechazada_at", "consolidada_en",
  // R170-03: HistorialProformas (tab facturación del embarque) muestra fecha,
  // operador y días de crédito por fila; sin estas columnas el select nunca
  // las trae y la tabla las pinta como '-'/'—'.
  "fecha_emision", "operador", "dias_credito",
  "total_mxn", "total_usd", "created_at",
  "facturas:factura_id(factura_pdf_url, factura_xml_url)",
].join(", ");
