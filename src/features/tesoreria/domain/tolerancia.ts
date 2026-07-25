/**
 * Re-export desde `@/lib/domain/tolerancia` para mantener retro-compatibilidad
 * dentro del feature `tesoreria` sin bloquear imports cross-feature.
 */
export {
  TOLERANCIA_MONTO_MXN,
  TOLERANCIA_DIAS,
  dentroDeTolerancia,
  deltaDiasIso,
  rangoFechasIso,
} from "@/lib/domain/tolerancia";
