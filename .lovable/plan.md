
## Problema

El botón "Volver" en el detalle de un borrador sustituto vuelve al listado (`/facturacion`) en vez de a la factura original. La corrección previa (13.301.23) resuelve el caso feliz vía `sessionStorage`, pero se cae cuando:

- El usuario recarga la página o cierra/reabre la pestaña (sessionStorage muere).
- Abre el borrador desde otra pestaña, deep-link, notificación o el listado.
- Cambia de dispositivo/navegador.

Analogía: hoy dejamos un "post-it" en el escritorio (sessionStorage) diciendo qué factura era la original. Si alguien limpia el escritorio, perdemos la referencia. La solución es preguntarle a la base de datos, que ya sabe la respuesta.

## Causa raíz

La tabla `public.facturas` ya tiene la columna `sustituye_a` (FK a la factura original), y `facturapi-emitir` la lee. Pero `fetchFacturaById` no la selecciona, así que el frontend nunca la ve. `useVolverAFacturaOriginal` sólo consulta `sessionStorage`.

## Plan

### 1. Exponer `sustituye_a` en el detalle

**Archivo:** `src/features/facturacion/services/detail.ts`

- Añadir `"sustituye_a"` a `COLUMNS` y al tipo `FacturaDetalle`.

### 2. Preferir la relación de BD en el hook de "Volver"

**Archivo:** `src/features/facturacion/hooks/useVolverAFacturaOriginal.ts`

- Recibir opcionalmente el `sustituye_a` de la factura actual (o leerlo con `useFactura(id)`).
- Orden de prioridad: `factura.sustituye_a` (fuente de verdad) → `findOriginalFacturaIdFor(id)` (fallback para el instante en que aún no se refresca la caché) → `/facturacion`.
- Mantener el label "Volver a factura F975" usando `useFactura(originalId)` como hoy.

### 3. Pequeño ajuste en `FacturaDetalle`

**Archivo:** `src/features/facturacion/routes/FacturaDetalle.tsx`

- Pasar `factura?.sustituye_a` al hook (o usar la nueva variante). Sin cambios visuales.

### 4. Versionado y changelog

- `APP_VERSION` → `13.301.28`
- Entrada en `CHANGELOG.md` explicando que "Volver" ahora usa `facturas.sustituye_a` como fuente primaria (persiste entre refreshes/pestañas/dispositivos) y `sessionStorage` queda sólo como acelerador.

### 5. Verificación

- `bun run ci:fast` verde.
- Test unitario ligero del hook: dado `sustituye_a` presente, `href` apunta a `/facturacion/<orig>` aunque no exista entrada en sessionStorage.

## Detalles técnicos

- No hay migración de BD: la columna ya existe y RLS ya permite lectura al owner.
- No se modifica el diálogo de sustitución ni la persistencia en `sessionStorage`; sigue útil para reabrir el paso "confirmar" del wizard.
- Sin cambios de comportamiento cuando la factura no es sustituta: `sustituye_a === null` → "Volver a facturación".
