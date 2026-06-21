# Bug: el checklist de cierre marca pendientes los conceptos ya facturados

## Diagnóstico (la analogía)

Imagina que `conceptos_venta.estado_facturacion` es un semáforo con sólo **dos luces**: `pendiente` y `en_proforma`. No tiene luz verde de "facturado". Cuando emites la factura de una proforma, el sistema cambia la **proforma** a `estado_proforma = 'facturada'`, pero **no toca los conceptos** — siguen marcados en `en_proforma`.

- El **tab de Facturación** ya sabe esto: deriva el tercer estado "facturado" en el frontend cruzando concepto → proforma (lo arreglamos en 13.90.5). Por eso ahí se ve bien.
- El **tab de Cierre** usa la RPC `validar_cierre_embarque` de la base de datos, y esa RPC sigue mirando sólo el semáforo crudo:

  ```sql
  -- migración 20260621004725, líneas 175-190
  COUNT(*) FILTER (WHERE estado_facturacion = 'pendiente'),
  COUNT(*) FILTER (WHERE estado_facturacion = 'en_proforma')
  ```

  Como tus conceptos están en `en_proforma` (aunque la proforma ya esté facturada), la regla `venta_conceptos_facturados` cuenta cada uno como pendiente y bloquea el cierre.

Es exactamente el mismo bug que arreglamos visualmente, pero ahora del lado de la base de datos.

## Solución

Alinear la RPC con la lógica derivada del frontend: un concepto cuenta como **facturado** si su proforma vinculada está en `estado_proforma = 'facturada'`. Sólo bloquear cuando queden conceptos verdaderamente pendientes.

### Cambios

1. **Migración Postgres** — reescribir el bloque `venta_conceptos_facturados` dentro de `validar_cierre_embarque` (versión más reciente, `20260621004725_...sql`):
   - `pendientes` = conceptos con `estado_facturacion = 'pendiente'` y sin `proforma_id`.
   - `en_proforma` = conceptos con `estado_facturacion = 'en_proforma'` cuya proforma está en un estado **distinto** de `'facturada'`.
   - La regla pasa (`ok = true`) cuando `pendientes = 0 AND en_proforma = 0`.
   - El `detalle` mantiene la misma forma `{ pendientes, en_proforma }` para no romper los formatters de `cierreCheckMeta`.

2. **No tocar** `conceptos_venta.estado_facturacion` ni los enums: dejamos el campo binario como está; la fuente de verdad sigue siendo la proforma, igual que en el frontend. Cero backfill, cero riesgo en embarques históricos.

3. **Tests**:
   - `src/features/embarques/components/__tests__/TabCierre.rules.test.ts` no cambia (sigue validando la composición AND).
   - Agregar un test del lado SQL no es viable aquí; documentamos el escenario en el changelog.

4. **Versionado**:
   - `src/constants/appVersion.ts` → bump a `13.90.7`.
   - `CHANGELOG.md` (raíz) → entrada `## [13.90.7] - 2026-06-21` con `fix(embarque-cierre-regla-venta-facturados)` explicando el cruce con proforma facturada.

### Detalle técnico (para referencia)

SQL del bloque corregido (esqueleto):

```sql
SELECT
  COUNT(*) FILTER (
    WHERE cv.estado_facturacion = 'pendiente' AND cv.proforma_id IS NULL
  ),
  COUNT(*) FILTER (
    WHERE cv.estado_facturacion = 'en_proforma'
      AND COALESCE(p.estado_proforma, 'pendiente') <> 'facturada'
  )
INTO v_venta_pendientes, v_venta_en_proforma
FROM conceptos_venta cv
LEFT JOIN proformas p ON p.id = cv.proforma_id AND p.deleted_at IS NULL
WHERE cv.embarque_id = p_embarque_id
  AND cv.deleted_at IS NULL;
```

## Archivos a modificar

- Nueva migración Supabase: `CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(...)` con el bloque corregido (el resto idéntico a la versión vigente).
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Resultado esperado

Tras aplicar la migración, abrir el tab de Cierre del ELIMP00230: la regla "Todos los conceptos de venta facturados" pasa a verde y `puede_cerrar` deja de estar bloqueado por esa causa (otras reglas siguen evaluándose independientemente).
