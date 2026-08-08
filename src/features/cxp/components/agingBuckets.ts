/**
 * Cubetas de aging para CxP.
 *
 * v13.462.0 — La definición vive en `@/lib/aging/buckets` (fuente única para
 * las tres vistas de antigüedad). Este archivo sólo reexporta con los alias
 * históricos que usan las pantallas de CxP.
 */
export {
  bucketDeDias,
  CUBETA_LABELS as BUCKET_LABELS,
  CUBETA_TONE as BUCKET_TONE,
  type CubetaAging,
} from "@/lib/aging/buckets";
