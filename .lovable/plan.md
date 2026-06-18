# Fix detalle de cotización: tipo de contenedor + embarque vinculado

## Contexto (datos reales de COT-2026-0076)

- `cotizaciones.tipo_contenedor = '8014e97d-37a6-4e99-9238-fd507543c340'` → es un UUID del catálogo `tipos_contenedor`. La UI lo renderiza tal cual (`{cotizacion.tipo_contenedor || '-'}`) y por eso ves el UUID.
- `cotizaciones.embarque_id = NULL` y `embarques.cotizacion_id IS NULL` en el embarque `ELIMP00272` que sí se generó desde esta cotización (created_at del embarque coincide con updated_at de la cot.). Además el botón "Ver embarque borrador" sólo aparece cuando `estado === 'Aceptada'`, pero el estado actual es `En operación`, así que aunque el vínculo existiera no se mostraría.

## Problema A — Tipo de contenedor en UUID

Hoy el catálogo `tipos_contenedor` se guarda como UUID en `cotizaciones.tipo_contenedor`. La cotización vieja guarda strings (`"20'"`, `"40HC"`). Hay que resolver ambos casos a un **nombre legible**.

### Cambios

1. Reusar el hook existente `useTiposContenedor` (ya consume `tipos_contenedor`).
2. En `src/features/cotizacion/components/seccionMercancia/MercanciaInfoGrid.tsx`:
   - Recibir `tiposContenedor` (o llamar al hook) y mapear `tipo_contenedor` → `nombre` si es UUID; si no matchea, mostrar el valor crudo como fallback.
   - Si no resuelve a nada legible, mostrar `'-'`.
3. Aplicar el mismo helper en:
   - `src/pages/cotizaciones/CotizacionInformativaDetalle.tsx` línea 103 (renglón de tarifas).
   - PDF de cotización si renderiza este campo (revisar `usePdfPreviewCotizacionPage`).
4. Crear util `resolveTipoContenedorNombre(value, catalogo)` en `src/features/cotizacion/utils/` con tests unitarios (UUID match, string legacy, vacío).

## Problema B — Embarque generado no visible

### Cambios en `CotizacionDetalleSecciones.tsx` y página detalle

1. Cargar `fetchEmbarquesVinculados(cotizacionId)` desde `CotizacionDetalle.tsx` (ya existe el servicio) y pasarlo como prop `embarquesVinculados: Array<{id, expediente, estado}>`.
2. Combinar con `embarque_id` directo para no perder casos legacy.
3. Mostrar el botón "Ver embarque" siempre que `embarquesVinculados.length > 0`, sin gatear por `estado === 'Aceptada'`. Estados válidos: `Aceptada`, `En operación`, `Cerrada`.
4. Si hay un solo embarque → botón directo `Ver embarque ELIMP00272`. Si hay varios → `DropdownMenu` listando expediente + estado, cada uno navegando a `/embarques/{id}`.
5. Mantener "Crear embarque" sólo cuando `estado === 'Aceptada'` y no hay vinculados.

### Backfill puntual

Migración SQL (idempotente) para reparar vínculos rotos detectados:
```sql
-- Vincula embarques cuyo cotizacion_id es null pero cuya cotización
-- quedó en "En operación" y matchea por cliente + ventana de tiempo.
-- Acota a la org y registra en bitácora.
```
Aplicarlo al menos a COT-2026-0076 ↔ ELIMP00272 explícitamente (UPDATE puntual con WHERE id=...) para resolver el caso visible hoy. Se deja la corrección general para una auditoría posterior.

## Investigación complementaria (no bloquea)

Documentar como deuda: revisar `useEmbarqueSubmitOrchestrator.ts:113` — solo asigna `cotizacion_id` cuando `p.cotizacionVinculada` está presente. Validar que el flujo "Crear embarque desde cotización" siempre llene ese payload (parece que en algunos paths se pierde). Se abrirá ticket aparte para no mezclar con este fix.

## Versionado

- `APP_VERSION` → `13.66.0`.
- Entrada nueva en `CHANGELOG.md` describiendo ambos fixes y el backfill puntual.

## Tests

- Unit: `resolveTipoContenedorNombre` (3 casos).
- Componente: `CotizacionDetalleSecciones` renderiza botón "Ver embarque" en estado `En operación` cuando hay vinculados; dropdown cuando hay >1.
- Integración: `MercanciaInfoGrid` muestra nombre cuando el catálogo tiene el UUID.

## Archivos afectados

- `src/features/cotizacion/components/seccionMercancia/MercanciaInfoGrid.tsx`
- `src/features/cotizacion/components/CotizacionDetalleSecciones.tsx`
- `src/pages/cotizaciones/CotizacionDetalle.tsx`
- `src/pages/cotizaciones/CotizacionInformativaDetalle.tsx`
- `src/features/cotizacion/utils/resolveTipoContenedorNombre.ts` (nuevo) + test
- `supabase/migrations/<timestamp>_relink_cot_2026_0076.sql` (backfill puntual)
- `src/constants/appVersion.ts`, `CHANGELOG.md`
