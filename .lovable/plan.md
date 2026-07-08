## Diagnóstico

Cuando Valeria actualiza el ETA del embarque 256, se insertan **dos eventos idénticos** en `eventos_embarque` con tipo `Cambio de ETA`. Motivo:

1. **Frontend** (`TrackingNuevoEventoForm.tsx`, línea 111): tras `actualizarEta.mutateAsync(...)`, llama `crearEvento.mutateAsync({ tipo: "Cambio de ETA", ... })` → **Evento #1**.
2. **Trigger de BD** `trg_embarques_log_eta_change` sobre `embarques`: al hacer `UPDATE embarques SET eta = ...`, la función `log_embarque_eta_change` inserta automáticamente otro evento `Cambio de ETA` → **Evento #2**.

La función del trigger ya tiene un guard de deduplicación (busca eventos "Cambio de ETA" creados en los últimos 30 s), pero corre **antes** del insert del frontend, por lo que el guard nunca ve el evento del frontend y se dispara igual. El resultado es un registro duplicado en la timeline.

El mismo defecto aplica a "Marcar Llegada real": el frontend inserta un `Arribo a Puerto` y el trigger, al detectar cambio en `fecha_llegada_real`, inserta otro.

**Analogía:** Es como si al firmar la bitácora, un asistente también firmara automáticamente "por si acaso" — terminamos con dos firmas iguales.

## Decisión

El frontend es la fuente rica: incluye el email del usuario real (no `sistema`), la `ubicacion`/`fuente` capturada por el operador y una `fecha` significativa. El trigger sólo era una red de seguridad.

**Fix:** eliminar el trigger `trg_embarques_log_eta_change` y su función `log_embarque_eta_change`. El frontend queda como única vía de registro para estos dos eventos, y ya está encapsulado en `TrackingNuevoEventoForm` (única UI que actualiza `eta` y `fecha_llegada_real`).

## Cambios

### 1. Migración de BD

Nueva migración `supabase/migrations/<timestamp>_drop_log_embarque_eta_change.sql`:

```sql
DROP TRIGGER IF EXISTS trg_embarques_log_eta_change ON public.embarques;
DROP FUNCTION IF EXISTS public.log_embarque_eta_change();
```

Justificación en comentario: se elimina para evitar duplicados con los inserts explícitos del frontend en `TrackingNuevoEventoForm`.

### 2. Limpieza retroactiva del embarque 256

Como parte de la misma migración, un `DELETE` idempotente que borre los duplicados existentes (mantener el evento más antiguo por embarque + minuto):

```sql
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY embarque_id, tipo, date_trunc('minute', created_at)
           ORDER BY created_at ASC
         ) AS rn
  FROM public.eventos_embarque
  WHERE tipo IN ('Cambio de ETA', 'Arribo a Puerto')
    AND deleted_at IS NULL
)
UPDATE public.eventos_embarque
SET deleted_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

Se hace soft-delete (`deleted_at`), coherente con el resto de la tabla.

### 3. Versionado y changelog

- `src/constants/appVersion.ts` → `13.214.7`.
- `CHANGELOG.md` → nueva entrada `[13.214.7] - 2026-07-08` describiendo el fix del duplicado.

## Detalles técnicos

- No se modifica ningún archivo TS/TSX: la lógica del frontend ya es correcta.
- El trigger `trg_embarques_freeze_eta_original` (que congela `eta_original`) se conserva — es una responsabilidad distinta.
- No afecta el módulo de auditoría ni notificaciones: ninguno depende de `log_embarque_eta_change`.
- RLS y GRANTs no cambian (sólo se elimina un trigger/función).

## Fuera de alcance

- Cambios de UI en la timeline.
- Otros triggers de `embarques`.
