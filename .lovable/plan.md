# Paso 2 — Deshabilitar timbrado para facturas anteriores al 01/07/2026

**Regla:** ninguna factura con `created_at < 2026-07-01` puede timbrarse desde el sistema (ya se timbró directo en el SAT). Aplica a **todas** las organizaciones (132 facturas afectadas: 124 Elogistix + 7 en otra org + 1 borrador). Solo cambios de frontend, sin migraciones.

## Cambios de código

### 1. Nueva bandera derivada `puedeTimbrarDesdeSistema`

Archivo: `src/features/facturacion/domain/facturaFlags.ts`

- Añadir constante exportada `FECHA_INICIO_TIMBRADO_SISTEMA = "2026-07-01T00:00:00Z"`.
- Extender `FacturaFlagsInput` con `created_at?: string | null`.
- Extender `FacturaFlags` con un booleano `puedeTimbrarDesdeSistema` = `sinTimbrar && created_at >= FECHA_INICIO_TIMBRADO_SISTEMA`.
- Actualizar test `facturaFlags.test.ts` con casos: sin fecha, antes del corte, después del corte, ya timbrada.

### 2. Ocultar botón "Timbrar factura" en el detalle

Archivo: `src/features/facturacion/components/detalle/FacturaDetalleActions.tsx`

- Aceptar prop `puedeTimbrarDesdeSistema: boolean`.
- Sustituir la condición `canEdit && sinTimbrar` del botón por `canEdit && puedeTimbrarDesdeSistema`.
- `FacturaDetalle.tsx` pasa la nueva prop.

### 3. Ocultar botón "Timbrar" en la tabla de facturas

Archivo: `src/features/facturacion/routes/facturacionColumns.tsx`

- En la línea del `timbrable`, agregar la comprobación de fecha usando el helper (reutilizar `FECHA_INICIO_TIMBRADO_SISTEMA`).

### 4. Bloquear apertura automática vía URL

Archivo: `src/features/facturacion/hooks/useAutoAbrirTimbrar.ts`

- El hook ya recibe `sinTimbrar`; cambiaremos la firma a `puedeTimbrarDesdeSistema` y `FacturaDetalle.tsx` pasará la nueva bandera. Si alguien navega con `?accion=timbrar` en una factura vieja, se limpia el query param sin abrir el diálogo.

### 5. Comportamiento adicional (no visual)

- Nada más. No se cambia `sinTimbrar`, así que el badge "Sin timbrar" del header sigue apareciendo si el usuario lo veía (esto es intencional: el estado real de la BD no ha cambiado). El usuario pidió "sin badge, solo ocultar botón".

## Fuera de alcance

- No se toca la BD (no se marca `uuid_fiscal`, no se cambia `estado`).
- No se toca el flujo de notas de crédito ni de complementos REP (esos siguen dependiendo de sus propios estados).
- No se modifica el backend/edge function `facturapi-emitir` (bloqueo puramente en UI, coherente con "app interna, usuarios de confianza").

## Validación

- `bunx vitest run src/features/facturacion/domain/__tests__/facturaFlags.test.ts` verde.
- Test manual: entrar a `/facturacion/<id-viejo>` — no debe salir el botón "Timbrar factura"; entrar a uno nuevo — sí debe salir.
- Verificar tabla `/facturacion`: filas antiguas sin botón "Timbrar".

## Registro

- `APP_VERSION` → `13.171.3`.
- Entrada en `CHANGELOG.md`: "Ocultar acción de timbrar en facturas anteriores al 01/07/2026 (timbradas fuera del sistema)".
