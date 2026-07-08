# Excluir embarques cerrados de "Compras › Por capturar"

## Objetivo
Que la bandeja `/compras/por-capturar` **oculte** los embarques en estado `Cerrado`. Así el equipo sólo verá expedientes activos donde todavía tiene sentido capturar facturas de proveedor. Los 100 embarques cerrados legacy dejan de aparecer.

## Cambio único: RPC `cxp_por_capturar`

Se actualiza la función SQL agregando un filtro por estado del embarque. Todo lo demás (columnas, orden, límite, cálculo de totales) queda igual.

```text
WHERE e.deleted_at IS NULL
  AND e.estado <> 'Cerrado'   ← nuevo
```

Se ejecuta como migración (`CREATE OR REPLACE FUNCTION`), sin cambios en frontend ni en tipos generados: la firma de la función no cambia.

## Fuera de alcance
- No se toca el módulo `/compras/por-pagar` (facturas ya capturadas, ahí sí interesa ver cerradas hasta que se paguen).
- No se toca el dashboard de `/compras` ni la conciliación.
- No se marca nada en base de datos: los embarques cerrados siguen tal cual, sólo se filtran de esta vista.

## Versionado
- `APP_VERSION` → `13.215.1` (patch).
- Nueva entrada `[13.215.1]` en `CHANGELOG.md` describiendo el filtro.

## Reversible
Con un `CREATE OR REPLACE FUNCTION` que quite el filtro se regresa al comportamiento anterior. No hay pérdida de datos.
