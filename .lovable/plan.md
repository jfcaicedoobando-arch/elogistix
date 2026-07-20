# Cotizaciones estancadas en "Aceptada" con embarque activo

## Diagnóstico

La COT-2026-0138 (y otras 49) sigue en **Aceptada** aunque ya tiene un embarque vinculado (ELIMP00333 – Borrador).

Causa: hay dos caminos para crear el embarque desde una cotización y sólo uno actualiza el estado.

| Camino | ¿Actualiza `estado` a "En operación"? |
|---|---|
| Wizard "Nuevo embarque" (`useEmbarqueSubmitOrchestrator`) | ✅ Sí (línea 136) |
| Botón "Convertir a borrador" → RPC `crear_embarque_borrador_core` | ❌ No — sólo hace `SET embarque_id = v_embarque_id` |

Auditoría de la tabla `cotizaciones`:

- **50** filas en `Aceptada` con `embarque_id` apuntando a un embarque **no** borrado → deberían estar en `En operación`.
- **3** filas en `En operación` con `embarque_id = NULL` (COT-2026-0016 / 0030 / 0033) → embarque borrado antes del fix v13.303.14, quedó huérfano. Deberían volver a `Aceptada`.
- **0** filas apuntando a un embarque soft-deleted (el fix reciente ya nulifica el vínculo).

## Cambios

### 1. RPC `crear_embarque_borrador_core`

Agregar dentro del mismo `UPDATE public.cotizaciones` que ya fija `embarque_id`:

```sql
UPDATE public.cotizaciones
   SET embarque_id = v_embarque_id,
       estado      = 'En operación'::estado_cotizacion,
       updated_at  = now()
 WHERE id = p_cotizacion_id;
```

Con eso, cualquier conversión futura promueve el estado atómicamente en la misma transacción que crea el borrador.

### 2. Backfill de datos existentes

Migración de datos (mismo archivo de migración) que corrige las inconsistencias detectadas:

```sql
-- Promover Aceptada → En operación cuando ya hay embarque vivo
UPDATE public.cotizaciones c
   SET estado = 'En operación', updated_at = now()
  FROM public.embarques e
 WHERE c.embarque_id = e.id
   AND e.deleted_at IS NULL
   AND c.estado = 'Aceptada';

-- Revertir En operación → Aceptada si el embarque ya no existe
UPDATE public.cotizaciones
   SET estado = 'Aceptada', updated_at = now()
 WHERE estado = 'En operación'
   AND embarque_id IS NULL;
```

### 3. Verificación

Después de aplicar la migración:

- COT-2026-0138 debe mostrar chip **En operación** en la tabla.
- Las 3 cotizaciones huérfanas vuelven a **Aceptada** y pueden convertirse de nuevo.
- El wizard tradicional sigue funcionando (ya usaba `updateEstadoCotizacion` a "En operación"; queda idempotente).

### 4. Changelog

`APP_VERSION` → `13.303.16` + entrada en `CHANGELOG.md`:

> Fix: al convertir una cotización aceptada en borrador de embarque, la cotización ahora avanza automáticamente al estado "En operación". Backfill de 50 cotizaciones que estaban estancadas en "Aceptada" y 3 con vínculo roto.

## Fuera de alcance

- No se toca la máquina de estados de embarques.
- No se agrega trigger genérico; la promoción sigue viviendo en los dos puntos de entrada (wizard y RPC) para mantener el control explícito del flujo.
