# Cambio de clave SAT default para conceptos de factura

Actualmente el sistema precarga la clave SAT `78101800` (Servicios de transporte de carga) al crear conceptos de facturas emitidas. Cambiaremos el default a `81141601` (Servicios de transitarios / freight forwarding) en todos los puntos donde se aplica.

## Alcance

Solo aplica a **conceptos de facturas emitidas a clientes** (tabla `conceptos_factura`). No se toca:
- `proveedores.clave_sat_producto` (facturas de proveedor).
- Conceptos ya guardados en BD con la clave anterior (permanecen intactos; el usuario puede editarlos manualmente si lo requiere).

## Cambios

### 1. Base de datos (migración)
- `ALTER TABLE public.conceptos_factura ALTER COLUMN clave_sat SET DEFAULT '81141601';`

### 2. Código (fallbacks del cliente)
- `src/features/facturacion/services/conceptosFacturaCrud.ts` → fallback `"78101800"` → `"81141601"`.
- `src/features/facturacion/services/facturaManual.ts` → fallback `"78101800"` → `"81141601"`.

### 3. Tests
- `src/features/facturacion/services/__tests__/facturaManual.test.ts` → actualizar expectativa del default.
- `src/features/facturacion/services/__tests__/conceptosFacturaCrud.test.ts` → actualizar fixture del default.

### 4. Housekeeping
- Bump `APP_VERSION` (patch).
- Entrada en `CHANGELOG.md`.

## Fuera de alcance
- No se actualizan migraciones históricas ni conceptos previamente insertados.
- No se agrega UI para editar la clave SAT default por organización (se puede proponer aparte).
