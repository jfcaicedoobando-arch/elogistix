# Facturación muestra embarques eliminados

## Qué está pasando

Los embarques se eliminan en "lógico": la fila se queda en la base con una marca `deleted_at` y todas las pantallas deben ignorar las filas marcadas. Dos consultas del módulo de Facturación se olvidaron de ese filtro, así que los expedientes borrados siguen apareciendo.

Verificado en la base: hay 6 embarques eliminados; al menos `ELIMP00275` (ETA 03/08/2026) y `ELIMP00274` (ETA 11/08/2026) caen dentro de los rangos de fecha que usan esas dos listas, por lo que se muestran hoy.

## Corrección (mínima, sin features nuevas)

1. Lista "por facturar" / hueco de facturación: agregar el filtro de no-eliminados a la consulta de embarques.
2. Proyección de facturación del mes: mismo filtro (hoy sólo excluye "Cancelado", no los eliminados).
3. Referencias de embarque al timbrar (Expediente / BL): tratar un embarque eliminado como inexistente, para no arrastrar datos de un expediente borrado al CFDI.
4. Pruebas unitarias que verifiquen que estas tres consultas aplican el filtro (mismo patrón que las pruebas existentes de conceptos con borrado lógico).

Fuera de alcance: otros módulos (CxP, proformas, portal) no se tocan en esta ola.

## Detalle técnico

- `src/features/facturacion/services/huecoFacturacion/fetchSources.ts` → `fetchEmbarquesParaHueco`: agregar `.is("deleted_at", null)`.
- `src/features/facturacion/services/proyeccion/fetchSources.ts` → `fetchEmbarquesMes`: agregar `.is("deleted_at", null)`.
- `src/features/facturacion/services/referenciasEmbarque.ts` → `fetchReferenciasEmbarque`: agregar `.is("deleted_at", null)` (devuelve `null` si está eliminado).
- Tests nuevos con el mock de cadena de Supabase (`_supabaseChainMock`) verificando que la operación `is` está presente.
- Cierre: bump de `APP_VERSION` + entrada en `CHANGELOG.md`.
