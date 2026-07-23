## Diagnóstico verificado

**Estado actual en BD** (verificado con `psql`):

- `PRO-2026-0970` → `estado_proforma='pendiente'`, `estado_cliente='aceptada'`, `factura_id=NULL`.
  → `getEstadoUnificado()` la muestra como **"aceptada"** (bug reportado).
- `facturas` del embarque `943222de…`:
  - **F971**: `estado='Cancelada'`, `cancellation_status='accepted'`, `proforma_id=d0be4a81…`, `sustituida_por=NULL` ⚠️
  - **F981**: `estado='Pagada'`, `proforma_id=d0be4a81…`, `sustituye_a=F971` ✅

Bitácora confirma el flujo: F971 timbrada 07-10 → duplicada para sustitución 07-15 → F981 timbrada 07-15 → F971 cancelada async por cron el 07-17 (`facturapi_cancelada_async`).

## Causa raíz

Cuando el cron `facturapi-reconciliar-cancelaciones` marca F971 como cancelada, ejecuta `applyAccepted` (`supabase/functions/facturapi-reconciliar-cancelaciones/index.ts:49`):

```
70:  supabase.rpc("revertir_proforma_al_cancelar_sustitucion", …) // OK: detecta F981 viva y no hace nada
72:  const esSustitucion = !!factura.sustituida_por;              // ⚠️ F971.sustituida_por = NULL
73:  if (!esSustitucion) await revertirProformas(supabase, ...)   // se ejecuta por error
```

Y `revertirProformas` (líneas 27-47) hace UPDATE ciego:

```
si (factura_id IS NULL && factura_secundaria_id IS NULL)  // ambos NULL en esta proforma
  estado_proforma = 'pendiente'                            // pisa el 'facturada' correcto
```

Nunca verifica si hay una factura sustituta viva apuntando a la misma proforma vía `proforma_id` o `conceptos_factura.proforma_id_origen`. La RPC `revertir_proforma_al_cancelar_sustitucion` sí lo hace bien; el problema es que el helper del edge la pisa.

El mismo helper duplicado existe en `supabase/functions/facturapi-cancelar/cancelacion.ts:210-236` (path de cancelación síncrona) — mismo bug.

Además, el flujo de sustitución **nunca setea `facturas.sustituida_por`** en la factura original al timbrar la sustituta, así que `esSustitucion` siempre es `false` por esta vía. `F981.sustituye_a` sí está correcto.

## Solución

### 1. Backend — dos edge functions

**`supabase/functions/facturapi-reconciliar-cancelaciones/index.ts`**
- Borrar la función local `revertirProformas` (líneas 27-47) y su llamada en la línea 73.
- Dejar únicamente `revertir_proforma_al_cancelar_sustitucion` (RPC, línea 70) que ya cuenta facturas hermanas vivas por `proforma_id` + `conceptos_factura.proforma_id_origen`.
- Adicionalmente, limpiar sólo los punteros `factura_id`/`factura_secundaria_id` que apunten explícitamente a la factura cancelada, sin tocar `estado_proforma` ni `fecha_facturacion`.

**`supabase/functions/facturapi-cancelar/cancelacion.ts`**
- Mismo tratamiento en `revertirProformasCancelacion` (210-236): quitar el bloque `if (ambosNulos)` que resetea `estado_proforma`, `fecha_facturacion`, `folio_factura_externa`. Delegar a la RPC.
- Asegurar que el caller (`index.ts` de `facturapi-cancelar`) también invoque la RPC después de marcar la factura como cancelada, si no lo hace ya.

### 2. Marcar `sustituida_por` al emitir la sustituta

En `supabase/functions/facturapi-emitir/` (o donde se timbra el borrador con `sustituye_a` seteado), tras emisión exitosa hacer:

```sql
UPDATE facturas
SET sustituida_por = <id_sustituta_recien_timbrada>
WHERE id = <id_original> AND sustituida_por IS NULL;
```

Esto hace que futuras cancelaciones tengan la señal correcta de sustitución para bitácora y para cualquier consumidor que dependa de `sustituida_por`.

### 3. Reparación de datos — PRO-2026-0970

Backfill puntual (SQL de datos, no migración de esquema):

```sql
UPDATE proformas
SET estado_proforma   = 'facturada',
    fecha_facturacion = (SELECT fecha_emision FROM facturas WHERE id = '75fe099b-d9f8-4277-878f-5ccb0ad7eb24'),
    factura_id        = '75fe099b-d9f8-4277-878f-5ccb0ad7eb24'  -- F981 (viva)
WHERE id = 'd0be4a81-d199-4cec-bfc2-4bf9736523d2';

UPDATE facturas
SET sustituida_por = '75fe099b-d9f8-4277-878f-5ccb0ad7eb24'
WHERE id = 'dc1e0162-ae7a-474b-abed-3b6301a86add' AND sustituida_por IS NULL;

INSERT INTO bitacora_actividad (...) VALUES
  (..., 'backfill_proforma_facturada', 'facturacion',
   'd0be4a81…', jsonb_build_object('motivo', 'PRO-2026-0970 revertida por bug en reconciliar-cancelaciones', 'factura_activa', 'F981'));
```

### 4. Detección de casos silenciosos

Auditoría one-shot: buscar todas las proformas en el mismo estado inconsistente y arreglarlas de una vez.

```sql
SELECT p.id, p.numero
FROM proformas p
WHERE p.estado_proforma = 'pendiente'
  AND EXISTS (
    SELECT 1 FROM facturas f
    WHERE f.proforma_id = p.id
      AND f.estado NOT IN ('Cancelada','Sustituida')
      AND f.deleted_at IS NULL
  );
```

Reparar cada una con el mismo patrón del punto 3 y registrar en bitácora.

### 5. Verificación

- Query final: la proforma PRO-2026-0970 sale como `facturada` con `factura_id` apuntando a F981.
- UI: `/embarques/943222de…?tab=facturacion` muestra el badge "Facturada".
- CHANGELOG entry `## [13.308.12]` describiendo el fix.

## Fuera de alcance

- No se toca la RPC `revertir_proforma_al_cancelar_sustitucion` (ya está bien).
- No se agregan nuevos tests E2E; sí un test unitario del helper del edge si se refactoriza a módulo importable.
- No se cambia UI ni state machine de proformas.
