/**
 * Cubetas de aging para CxP.
 *
 * v13.462.0 — La definición vive ahora en `@/lib/aging/buckets` (fuente única
 * para las tres vistas de antigüedad). Este archivo se conserva como
 * reexportación para no romper las importaciones existentes.
 */
export {
  bucketDeDias,
  CUBETAS_AGING,
  CUBETA_LABELS as BUCKET_LABELS,
  CUBETA_LABELS_LARGAS as BUCKET_LABELS_LARGAS,
  CUBETA_TONE as BUCKET_TONE,
  CUBETA_TONO_KPI,
  monedasPresentes,
  type CubetaAging,
  type TonoKpiAging,
} from "@/lib/aging/buckets";
