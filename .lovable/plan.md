
## Problema

El dashboard de Facturación muestra **33 proformas por revisar**, pero son datos viejos: proformas migradas del sistema anterior que ya fueron facturadas fuera de la app y quedaron con `estado_revision = 'pendiente'` porque nadie las tocó tras la migración.

Verificado en la base:

```text
33 proformas  →  estado_cliente = aceptada
                  estado_proforma = facturada
                  factura_id IS NULL      (facturadas fuera del sistema)
                  estado_revision = pendiente
```

Son exactamente el mismo tipo de basura que ya depuramos hace un momento en "Listas para facturar".

## Analogía

Es como una bandeja de "correo por leer" donde 33 sobres ya fueron abiertos, contestados y archivados hace meses — solo que nadie apretó el botón "marcar como leído". La bandeja miente.

## Fix (dos capas, igual que la vez pasada)

### 1. Corregir la query del KPI (evita futuros falsos positivos)

`src/features/proformas/services/queries.ts` — función que alimenta `useProformasPendientes`:

Añadir a la query que filtra `estado_revision = 'pendiente'`:
- `.neq("estado_proforma", "facturada")`
- `.is("factura_id", null)`
- `.is("deleted_at", null)`

Con esto, una proforma solo se considera "por revisar" si de verdad está pendiente y todavía no se facturó ni internamente ni por fuera.

### 2. Migración de backfill (limpia los 33 registros viejos)

Nueva migración que actualice a `estado_revision = 'aprobada'` las proformas que cumplen:
- `estado_cliente = 'aceptada'`
- `estado_proforma = 'facturada'`
- `estado_revision = 'pendiente'`
- `deleted_at IS NULL`

Es un `UPDATE` acotado — no toca datos vivos.

### 3. Housekeeping

- `CHANGELOG.md`: entrada nueva.
- `src/constants/appVersion.ts`: bump de versión patch.

## Resultado esperado

El KPI "Proformas por revisar" pasa de 33 → 0 (o al conteo real de pendientes legítimas), y a futuro no volverá a inflarse con basura legacy.

## Archivos a tocar

- `src/features/proformas/services/queries.ts` (filtros extra)
- `supabase/migrations/<timestamp>_backfill_proformas_revision.sql` (nueva)
- `CHANGELOG.md`
- `src/constants/appVersion.ts`
