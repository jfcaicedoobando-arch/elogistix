## Diagnóstico

**COT-2026-0077** quedó en un estado inconsistente:
- `cotizaciones.estado = 'En operación'` ✅
- `cotizaciones.embarque_id = NULL` ❌
- Embarque `ELIMP00273` (`a006c055-…`) creado en el mismo segundo, pero con `embarques.cotizacion_id = NULL` ❌

Por eso `fetchEmbarquesVinculados` (que filtra por `embarques.cotizacion_id = cot.id`) devuelve `[]`, la cotización entra en la rama `estadoSugiereEmbarque && embarques.length === 0` y `CotizacionDetalleEmbarques` muestra:

> "Esta cotización aparece como **En operación**, pero no hay embarques vinculados…"

Eso es el "error" que el usuario percibe.

## Causa raíz (dos bugs concurrentes)

### Bug 1 — RPC `crear_embarque_completo` ignora `cotizacion_id`
`useEmbarqueSubmitOrchestrator` arma el payload así:
```ts
const embarquePayload = {
  expediente,
  ...p.buildEmbarquePayload(...),
  ...(p.cotizacionVinculada ? { cotizacion_id: p.cotizacionVinculada.id } : {}),
};
```
y lo envía a `supabase.rpc('crear_embarque_completo', { p_embarque: toDbJson(...) })`.

Pero el `INSERT INTO embarques(...)` dentro del RPC **no incluye la columna `cotizacion_id`** en su lista. El campo se descarta silenciosamente → embarque sin vínculo.

### Bug 2 — Fase 4 del orquestador no escribe `embarque_id` en la cotización
```ts
await updateEstadoCotizacion.mutateAsync({
  id: p.cotizacionVinculada.id,
  estado: "En operación",
});
```
Sólo actualiza `estado`. Nunca setea `cotizaciones.embarque_id`. Aunque arregláramos el Bug 1, la cotización seguiría apuntando a `NULL` (la columna existe y es la que usan otras vistas: `CotizacionDetalleAcciones`, generadores de PDF, etc.).

> Nota: el flujo alterno `crear_embarque_borrador_desde_cotizacion` (RPC) sí actualiza `embarque_id`. El bug está sólo en el wizard de "Nuevo Embarque" cuando se vincula a una cotización existente.

## Fix

### 1. Migración: `crear_embarque_completo` debe persistir `cotizacion_id`

Migración SQL nueva (`fix_crear_embarque_completo_cotizacion_id`) — re-emite `CREATE OR REPLACE FUNCTION public.crear_embarque_completo(...)` idéntica a la actual, sumando:

- En la lista de columnas del `INSERT INTO embarques (...)`: agregar `cotizacion_id`.
- En `VALUES`: `CASE WHEN p_embarque->>'cotizacion_id' IS NOT NULL AND p_embarque->>'cotizacion_id' <> '' THEN (p_embarque->>'cotizacion_id')::uuid ELSE NULL END`.

Sin cambiar el resto del cuerpo (idempotency, conceptos, documentos, notas).

### 2. Mutación: setear `embarque_id` en la cotización tras crear el embarque

- `src/features/cotizacion/services/mutations/estado.ts` → nueva función `vincularEmbarqueACotizacion(cotizacionId, embarqueId, estado?)` que hace
  `update cotizaciones set estado=?, embarque_id=? where id=?`.
- Exponerla en `src/features/cotizacion/services/index.ts` y un hook nuevo `useVincularEmbarqueACotizacion` (o extender `useUpdateEstadoCotizacion` con un parámetro `embarqueId?`).
- En `useEmbarqueSubmitOrchestrator.ts`, capturar el `id` devuelto por `createEmbarque.mutateAsync` y, en la Fase 4, llamar a la nueva mutación con `{ estado: "En operación", embarqueId }`. La advertencia no bloqueante se conserva.

### 3. Data-fix: vincular COT-2026-0077 ↔ ELIMP00273

Migración de datos (`backfill_cot_2026_0077_embarque_link`) **idempotente**:

```sql
UPDATE public.embarques
   SET cotizacion_id = 'b75f1f9a-12b6-4cee-bbe5-db45df1f7c32'
 WHERE id = 'a006c055-e574-4e98-8738-b4f280c3c908'
   AND cotizacion_id IS NULL;

UPDATE public.cotizaciones
   SET embarque_id = 'a006c055-e574-4e98-8738-b4f280c3c908', updated_at = now()
 WHERE id = 'b75f1f9a-12b6-4cee-bbe5-db45df1f7c32'
   AND embarque_id IS NULL;
```

Después, la card "Embarques Generados" muestra `ELIMP00273` con su estado actual y deja de pintar el mensaje de error.

### 4. Verificación

- Query post-migración:
  ```
  select c.folio, c.estado, c.embarque_id, e.expediente, e.cotizacion_id
  from cotizaciones c join embarques e on e.id = c.embarque_id
  where c.folio = 'COT-2026-0077';
  ```
- Abrir `/cotizaciones/b75f1f9a-…` y confirmar que aparece la tarjeta con el link a `ELIMP00273` (sin el mensaje de advertencia).
- Test unitario nuevo: `useEmbarqueSubmitOrchestrator` — cuando hay `cotizacionVinculada`, llamar a la nueva mutación con `{ estado, embarqueId }` y propagar `cotizacion_id` al payload del RPC (mockeado).
- Test de servicio: `vincularEmbarqueACotizacion` envía ambos campos en el update.

### 5. Metadatos

- `APP_VERSION` → `13.66.7`.
- `CHANGELOG.md` con la entrada del fix y el backfill de COT-2026-0077.

## Archivos a tocar

- `supabase/migrations/<ts>_fix_crear_embarque_completo_cotizacion_id.sql` (RPC).
- `supabase/migrations/<ts>_backfill_cot_2026_0077_embarque_link.sql` (data-fix).
- `src/features/cotizacion/services/mutations/estado.ts` (+ index).
- `src/features/cotizacion/hooks/mutations/useCotizacionMutations.ts` (nuevo hook o extensión).
- `src/features/embarques/hooks/useEmbarqueSubmitOrchestrator.ts` (Fase 4).
- Tests asociados.
- `src/constants/appVersion.ts`, `CHANGELOG.md`.
