# Auto-sync de ETA/ETD desde JSONCargo (con confirmación)

Hoy `jsoncargo-track` actualiza la **ETA** del embarque silenciosamente cuando difiere de `eta_final_destination`. La ETD (`atd_origin`) no se sincroniza. Queremos:

1. **No** modificar fechas del embarque sin avisar.
2. Detectar diferencias en ETA y ETD, y preguntar al usuario si quiere aplicarlas.

## Cambios

### 1. Edge function `supabase/functions/jsoncargo-track/index.ts`
- Eliminar la actualización silenciosa de ETA (líneas 192–200).
- En el `summary` de respuesta, agregar:
  - `eta_propuesta` (string YYYY-MM-DD) derivada de `eta_final_destination`.
  - `etd_propuesta` (string YYYY-MM-DD) derivada de `atd_origin`.
  - `eta_actual`, `etd_actual` del embarque.
  - Flags `eta_difiere`, `etd_difiere`.
- Leer también `etd` del embarque al inicio.

### 2. Nueva edge function ligera o reusar RPC: aplicar fechas
Opción más simple: **no crear edge function nueva**. Aplicar el cambio directamente desde el cliente con `supabase.from('embarques').update({ eta, etd })` (RLS ya cubre admin/operador).

### 3. Hook `src/hooks/embarque/useJsonCargoTracking.ts`
- Extender `JsonCargoSummary` con `eta_propuesta`, `etd_propuesta`, `eta_actual`, `etd_actual`, `eta_difiere`, `etd_difiere`.
- Extender `extractSummary` para leer `atd_origin` del raw payload (para que la UI también pueda recalcular tras refresh).
- Agregar mutación `useApplyJsonCargoFechas({ embarqueId, eta?, etd? })` que actualiza `embarques` e invalida `queryKeys.embarques.detail`.

### 4. UI `src/components/embarque/TrackingLiveCard.tsx`
- Tras un sync exitoso, si `summary.eta_difiere || summary.etd_difiere`, mostrar un bloque de propuesta:
  - "JSONCargo reporta nuevas fechas: ETD `dd MMM yyyy` (actual: …), ETA `dd MMM yyyy` (actual: …)."
  - Botones: **Actualizar embarque** / **Ignorar**.
- Al confirmar, llamar `useApplyJsonCargoFechas` con los campos que difieran y mostrar toast.
- También mostrar el bloque cuando exista `tracking.raw_payload` con diferencias respecto al embarque actual (persistente entre recargas hasta que se aplique o se cierre).

### 5. `supabase/functions/jsoncargo-track-batch/index.ts` (cron)
- Quitar la actualización silenciosa de ETA. El batch solo sincroniza eventos y `tracking_externo`. La ETA/ETD se quedan como propuesta visible en la UI.
- Alternativa: dejar opcional vía un flag `auto_apply_dates` en `configuracion`, **fuera del alcance** de esta tarea — no se incluye.

### 6. Cambios cosméticos
- En el card de tracking, mostrar también `ETD origen (atd_origin)` junto al `ETA destino final` que ya existe.

## Detalles técnicos

- `atd_origin` y `eta_final_destination` vienen de JSONCargo en formato no ISO; ya hay `parseJsonCargoDate` en `_shared/jsoncargo.ts`. Reutilizarlo.
- Comparación: tomar solo `slice(0,10)` para comparar contra `embarques.eta` / `embarques.etd` (date).
- Si `embarque.etd` es null y hay `atd_origin`, también proponer establecerla.
- Mutación cliente: invalidar `queryKeys.embarques.detail(id)` y `all`.

## Versionado
- Bump `APP_VERSION` a `8.132.6`.
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Verificación
- En `/embarques/{id}?tab=tracking`, sincronizar un embarque con ETA distinta → debe aparecer el bloque de propuesta con botones.
- Confirmar → ETA/ETD se actualizan, el bloque desaparece, toast de éxito.
- Ignorar → bloque se cierra (estado local) hasta el próximo sync.
- Embarques sin diferencia → no aparece el bloque.
