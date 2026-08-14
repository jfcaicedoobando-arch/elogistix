# Corregir los 3 fallos de CI del run 86323332022

El pipeline falló en tres jobs. Los otros (build, TypeScript, cobertura, Deno, knip) pasaron.

## 1. Pruebas (shard 2) — expediente con formato inválido

`rls-fixtures-expediente-format.test.ts` exige que los expedientes de las suites RLS usen `ELXXX00001` o `DEMO-YYYY-NNN`. La suite nueva de borrado lógico usa `SD-BORRADO-001`.

Cambio: renombrar el expediente del fixture a `ELSDL00001` en `supabase/tests/rls/test_rls_soft_delete_reportes.sql` (una sola ocurrencia en el `INSERT` del embarque borrado; el resto de las aserciones no dependen del texto).

## 2. ESLint — complejidad 17 en `useRefacturacion`

`src/features/facturacion/hooks/useRefacturacion.ts` línea 36 excede el máximo de 16.

Cambio: extraer la lógica de decisión del hook a helpers puros en un archivo hermano (por ejemplo `useRefacturacion.helpers.ts`) sin alterar el comportamiento ni la firma del hook, hasta bajar la complejidad a ≤16. No se toca la UI.

## 3. Arquitectura — H6: 16 violaciones de SECURITY DEFINER

Las migraciones de esta ola re-emitieron funciones `SECURITY DEFINER` sin repetir el candado `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated/service_role`:

- `20260814161725_...sql`: `libro_pagos`, `estado_cuenta_bancario`, `conciliacion_resumen`, `pnl_financiero_embarque`, `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos`.
- `20260824080000_ola14_soft_delete_reportes_replay.sql`: `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos`.

Las migraciones son inmutables, así que se sigue el patrón ya usado en la historia del proyecto (`FIX-H6-01` … `FIX-H6-17`):

1. Nueva migración `FIX-H6-18` que re-emite esas 6 funciones tal como están en vivo y agrega, para cada una, `REVOKE ALL ON FUNCTION ... FROM PUBLIC` y `GRANT EXECUTE ... TO authenticated, service_role`.
2. Subir el baseline de `scripts/audit-migrations.ts` al timestamp de esa migración, documentando el motivo en el bloque de comentarios (igual que los baselines anteriores).
3. Sincronizar los archivos espejo en `supabase/schema/` y actualizar `migration-manifest.json`.

## Verificación

- `bun run lint`, `bun run audit:migrations`, `audit:replay-mirror`, `audit:manifest`.
- La prueba `rls-fixtures-expediente-format` en verde.
- Registro en `CHANGELOG.md` y bump de `APP_VERSION` a 13.609.1.

## Notas técnicas

No cambia lógica de negocio: el punto 1 es un fixture, el 2 es refactor sin cambio funcional, y el 3 sólo re-declara permisos de ejecución que ya existen en la base (los `GRANT/REVOKE` en vivo no se perdieron; lo que falta es dejarlos escritos en la migración para instalaciones limpias).
