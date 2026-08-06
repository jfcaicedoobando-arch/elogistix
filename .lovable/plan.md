# Corregir contadores de conciliación bancaria (movimientos eliminados)

## Qué está pasando

En la cuenta BBVA USD las tarjetas del dashboard muestran 2 movimientos (1 pendiente, 1 conciliado, 8,775 de cargos pendientes), pero la tabla aparece vacía en todos los filtros.

Causa confirmada: la tabla y las tarjetas leen de fuentes distintas.

- La tabla filtra los movimientos borrados (`deleted_at`), por eso no muestra nada.
- La función de resumen del servidor `conciliacion_resumen` **no** filtra los borrados, así que sigue contando los 2 movimientos eliminados.

Es el único lugar de la base que lee movimientos bancarios sin excluir los eliminados.

## Qué se va a hacer

1. Actualizar la función de resumen para que ignore los movimientos eliminados, igual que ya lo hace la tabla. Así las tarjetas quedarán en cero para esta cuenta y siempre coincidirán con lo que se ve en la lista.
2. Sin cambios de permisos ni de datos: no se borra ni se modifica ningún movimiento; sólo se corrige el conteo.

## Detalle técnico

- Migración: `CREATE OR REPLACE FUNCTION public.conciliacion_resumen(uuid)` agregando `AND deleted_at IS NULL` al `WHERE`. Se conserva `STABLE SECURITY DEFINER`, `SET search_path = public` y el filtro de organización/`super_admin`.
- No requiere cambios en el frontend: `fetchConciliacionResumen` ya invalida y refresca con `queryKeys.tesoreria.all`.
- Se agrega el caso a la validación de soft-delete de tablas de dinero (`src/__tests__/architecture/soft-delete-money-tables.test.ts` ya cubre el service; el guardrail nuevo cubriría la función SQL) y se registra en `CHANGELOG.md` con bump de `APP_VERSION`.
