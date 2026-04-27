## Objetivo

Renombrar el estado `Embarcada` → `En operación` en cotizaciones para reflejar con precisión que la cotización fue aceptada Y ya tiene embarque vinculado. La transición de `Aceptada` → `En operación` será automática vía trigger cuando se cree el embarque desde la cotización.

## Estado actual

- Enum `estado_cotizacion` actual: `Borrador, Enviada, Confirmada, Rechazada, Vencida, Aceptada, Embarcada`
- 4 cotizaciones productivas en estado `Embarcada` que se migrarán
- El trigger `trg_sync_cotizacion_embarque_link` ya pobla `cotizaciones.embarque_id` automáticamente al crear un embarque, pero **no cambia el estado**

## Cambios

### 1. Base de datos (migración SQL)

Postgres no permite renombrar valores de enum directamente sin perder integridad. Patrón seguro:

```text
a) ALTER TYPE estado_cotizacion ADD VALUE 'En operación';
   (commit intermedio para que el nuevo valor sea usable)

b) UPDATE cotizaciones SET estado = 'En operación' WHERE estado = 'Embarcada';

c) Recrear el enum sin 'Embarcada':
   - Crear estado_cotizacion_new sin 'Embarcada'
   - ALTER TABLE cotizaciones ALTER COLUMN estado TYPE estado_cotizacion_new USING estado::text::estado_cotizacion_new
   - DROP TYPE estado_cotizacion; rename estado_cotizacion_new → estado_cotizacion
   - Restaurar default 'Borrador'
```

### 2. Trigger automático de transición

Modificar (o complementar) `trg_sync_cotizacion_embarque_link` para que, además de poblar `embarque_id`, ejecute:

```sql
UPDATE cotizaciones
SET estado = 'En operación'
WHERE id = NEW.cotizacion_id
  AND estado = 'Aceptada';
```

Solo se promueve desde `Aceptada` (no desde `Borrador`, `Rechazada`, etc.) para evitar transiciones inválidas.

### 3. RLS policy

Actualizar `Cliente read own cotizaciones` para reemplazar `'Embarcada'` por `'En operación'` en el array de estados visibles del portal.

### 4. Código frontend (reemplazos string `"Embarcada"` → `"En operación"`)

Archivos afectados:
- `src/lib/ui/estadoConfig.ts` — badge color índigo
- `src/services/portal/queries.ts` — array `PORTAL_COTIZACION_ESTADOS_VISIBLES`
- `src/hooks/cotizacion/useCotizacionesPageController.ts` — filtro y lógica de "tiene embarque"
- `src/hooks/embarque/useEmbarqueSubmitOrchestrator.ts` — al guardar embarque
- `src/services/cotizacion/conversiones/embarques.ts` — al convertir cotización
- `src/components/cotizacion/CotizacionDetalleSecciones.tsx` — render condicional
- `src/components/portal/cotizacion/PortalCotizacionEstadoBanner.tsx` — comentario JSDoc
- `src/integrations/supabase/types.ts` — se regenera automáticamente

> Los archivos del changelog histórico (`src/content/changelog/...`) **no se modifican** — son registros históricos.

### 5. Changelog

Nueva entrada **v8.99.6** explicando: renombramos `Embarcada` → `En operación` para reflejar mejor el flujo (Enviada → Aceptada → En operación), trigger ahora promueve estado automáticamente, datos existentes migrados.

## Resultado

```text
Flujo de cotización:
Borrador → Enviada → Aceptada ──(crea embarque)──► En operación
                  ↘ Rechazada
                  ↘ Vencida
```

- El cliente ve "En operación" tanto en el badge del listado como en el banner del detalle (lenguaje consistente).
- Los operadores pueden filtrar fácilmente "qué está aceptado pero pendiente de operar" vs "qué ya está en operación".
- Cero acción manual: el estado avanza solo al crear el embarque.
