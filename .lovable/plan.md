
## Problema

La página de detalle de una factura ya muestra "de qué proforma viene" porque la factura guarda `proforma_id`. Pero al revés no funciona: la proforma se apoyaba en su propio campo `factura_id` que:

- El flujo nuevo de conversión ("un clic") ya no llena — se quedó como `NULL`.
- Aunque lo llenara, sólo cabe **una** factura, y ahora una proforma puede convertirse en **varias** facturas (una por moneda: USD y MXN, porque el SAT no admite CFDI multi-moneda).

Verificado en la base: las últimas 15 proformas facturadas tienen `proforma.factura_id = NULL` a pesar de que su(s) factura(s) sí las apuntan vía `facturas.proforma_id`.

Resultado: en `ProformaDetalle` la sección "Factura asociada" no aparece — la información existe pero se lee del lado equivocado.

## Fix

Cambiar la consulta del detalle a la dirección correcta (factura → proforma) y soportar múltiples facturas.

### 1. Query — `src/features/proformas/services/queries.ts`

En `fetchProformaDetalle` (y su fila hermana si aplica), reemplazar la relación forward:

```text
facturas_full:factura_id(id, numero, estado, total, moneda, fecha_emision, uuid_fiscal, factura_pdf_url, factura_xml_url)
```

por la inversa (array vía FK `facturas.proforma_id`):

```text
facturas_asociadas:facturas!proforma_id(id, numero, estado, total, moneda, fecha_emision, uuid_fiscal, factura_pdf_url, factura_xml_url, deleted_at)
```

Ordenar por `created_at asc` para presentar en orden. Filtrar `deleted_at IS NULL` en cliente o en la relación (Supabase permite `filter`).

Se conserva `facturas:factura_id(...)` sólo si algún otro consumidor lo depende; si no, se elimina limpio.

### 2. Tipos — `src/features/proformas/services/types.ts`

- Reemplazar `facturas_full: {...} | null` por `facturas_asociadas: {...}[]`.
- Ajustar el tipo de retorno del hook y export re-export.

### 3. UI — `src/features/proformas/components/ProformaDetalleCards.tsx`

`FacturaAsociadaCard` pasa a recibir un array:

- Si `array.length === 0`: no renderiza (igual que hoy).
- Si `array.length === 1`: mismo diseño actual, título "Factura asociada".
- Si `array.length > 1`: título "Facturas asociadas (N)", una card por factura, cada una con su badge de estado, montos en su moneda, UUID y botón **Ver factura**.

### 4. Ruta — `src/features/proformas/routes/ProformaDetalle.tsx`

Pasar el array nuevo a `<FacturaAsociadaCard>` (línea 143).

### 5. Fallback legacy

Los datos históricos que aún tengan `proforma.factura_id` seteado pero **no** tengan `facturas.proforma_id` en su factura correspondiente. Antes del cambio de código haremos una verificación rápida: si existen huecos, un backfill que corra:

```text
UPDATE facturas f
SET proforma_id = p.id
FROM proformas p
WHERE p.factura_id = f.id AND f.proforma_id IS NULL AND f.deleted_at IS NULL;
```

(Sólo se ejecuta si el conteo previo `>0`.)

## Housekeeping

- `CHANGELOG.md`: entrada nueva.
- `src/constants/appVersion.ts`: bump a `13.213.46`.

## Analogía

Antes la proforma miraba sólo por una mirilla que dejó de usarse. Ahora mira desde el otro lado — la factura ya lleva su propia flecha "vengo de aquí", y la proforma sólo tiene que seguir esas flechas de vuelta. Y si son dos facturas (una por moneda), las muestra las dos.

## Archivos a tocar

- `src/features/proformas/services/queries.ts`
- `src/features/proformas/services/types.ts`
- `src/features/proformas/components/ProformaDetalleCards.tsx`
- `src/features/proformas/routes/ProformaDetalle.tsx`
- Migración opcional de backfill (sólo si hay huecos)
- `CHANGELOG.md`
- `src/constants/appVersion.ts`
