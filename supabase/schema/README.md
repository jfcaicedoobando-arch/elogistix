# SQL revisable y baseline

`supabase/schema/` contiene espejos de funciones por dominio y `baseline.sql`.
Revisado el **2026-09-26**.

## Fuentes

- `supabase/migrations/`: historia de aplicación, inmutable.
- Espejos SQL: cuerpos revisables, no despliegue automático.
- `baseline.sql`: referencia del schema esperado por CI.
- `scripts/audit-replay-mirror-baseline.json`: divergencias toleradas.
- `scripts/ci/rls-prepare-db.sh`: bootstrap/squash/replay efectivo.

No mantener conteos manuales de funciones ni tablas de migraciones “canónicas”
que ya fueron sustituidas. Consultar inventarios/auditores actuales.

## Modificar función

1. Localizar todas las definiciones/overloads y la de mayor timestamp efectiva.
2. Crear migración posterior con firma/cuerpo/grants correctos.
3. Actualizar espejo correspondiente.
4. Revisar/regenerar baseline y manifiesto cuando aplique.
5. Comprobar guards de schema/replay y checks DB.

Nunca editar una migración aplicada para que el auditor quede verde.
El espejo no demuestra que el cambio esté en producción.

## Divergencias

El JSON replay-mirror conserva **cuatro entradas** al 2026-09-26.
[Estado y criterio](../../docs/ola14-replay-mirror-saldo.md).
Esta limpieza no cambió SQL ni baseline.

## Referencias

- [Higiene SQL](../../docs/migrations-hygiene.md).
- [Baseline](../../docs/ops/baseline-esquema.md).
- [RLS](../tests/rls/README.md).
