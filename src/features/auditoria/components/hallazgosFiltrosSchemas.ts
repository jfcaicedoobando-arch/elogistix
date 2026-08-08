/**
 * Schemas Zod para los valores de los Select de filtros de hallazgos.
 *
 * Aunque Radix garantiza que el valor proviene de un `SelectItem.value` listado,
 * el parse explícito refuerza el contrato y deja un punto único de verdad
 * para los enums (evita los `as TipoX` en el `onValueChange`).
 */
import { z } from "zod";

export const reglaAuditoriaFiltroSchema = z.enum([
  "docs_faltantes",
  "docs_pendientes_avanzado",
  "fechas",
  "ventas_sin_facturar",
  "margen_negativo",
  "margen_bajo",
  "venta_sin_costo",
  "costo_sin_venta",
  "costos_repetidos",
  "proforma_vencida",
  "embarque_huerfano",
  "todas",
]);

export const severidadFiltroSchema = z.enum([
  "critico",
  "alto",
  "medio",
  "todas",
]);

export const filtroRevisionSchema = z.enum([
  "todos",
  "pendientes",
  "revisados",
  "en_progreso",
]);

export const filtroResponsableSchema = z.enum([
  "todos",
  "mios",
  "sin_asignar",
  "vencidos",
]);
