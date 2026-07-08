
# Limpiar warnings de knip introducidos por v13.216.x

Sólo se tocan los archivos/exports que quedaron huérfanos por los cambios recientes del tab Costos. Los otros hallazgos preexistentes (`TIPOS_EVENTO_TRACKING`, `useProformasPendientes`, `EventoTrackingFormValues`) quedan fuera de alcance — no forman parte de esta tanda.

## Cambios

1. Borrar `src/features/embarques/hooks/useCostosConFactura.ts` (ya no lo consume ningún componente; el tab Costos ahora usa `useReconciliacionEmbarque`).
2. Borrar `src/features/embarques/utils/estadoLiquidacionDerivado.ts` (los estados ahora se derivan de `FilaReconciliacion.estatus_renglon` dentro de `GrupoCostosProveedor`).
3. En `src/features/embarques/components/costos/GrupoCostosProveedor.tsx` quitar el export `ToggleGruposButton` (no se llegó a usar).
4. Verificar que ningún test todavía importe los símbolos borrados. Si hay alguno, ajustarlo.
5. Bump `APP_VERSION` → `13.216.2` y una línea en `CHANGELOG.md` (patch, sólo limpieza).

## Verificación
- `bun run lint:unused` deja de reportar los 3 hallazgos que introdujimos.
- `bunx tsgo --noEmit` limpio.
