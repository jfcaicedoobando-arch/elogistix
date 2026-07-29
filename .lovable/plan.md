## Estado del paquete MEDIOS (M1–M14)

Verifiqué uno por uno contra el repo y la base de datos:

| Fix | Estado |
|---|---|
| M1 SAFE-CAST freshness | Hecho (`safe-cast-freshness.test.ts`) |
| M2 `fromDbChecked` + ratchet | Hecho (`fromdb-zod-adoption.test.ts`) |
| M3 `roundMoney` | Hecho |
| M4 zod en `updateCotizacion` | Hecho |
| M5 sincronía de espejos | Hecho (`trg_embarques_sync_espejos`, `trg_clientes_propaga_nombre`, `trg_navieras_propaga_nombre`) |
| **M6 soft-delete en tablas de dinero** | **Incompleto — ver abajo** |
| M7 `organization_id` en costeo | Hecho (columnas presentes) |
| M8 seguridad (seed demo, cron secret, destinatarios) | Hecho |
| M9 perfil con TanStack Query | Hecho |
| M10 filtros CxP en URL (nuqs) | Hecho |
| M11 parser fiscal unificado | Hecho |
| M12 concurrencia limitada en acciones masivas | Hecho |
| M13 CHECK en `*_envios.estado` | Hecho (3 constraints en BD) |
| M14 extracción de hooks + guardrail | Hecho |

## Lo que falta: M6 (y es un bug vivo, no solo deuda)

La mitad de frontend de M6 sí se aplicó, pero **la migración nunca se creó**. Es como haber puesto la cerradura en la puerta sin instalar la puerta: el código ya filtra por una columna que en la base no existe.

Verificado en la base: solo `proveedores` y `bbva_movimientos` tienen `deleted_at`. **No** la tienen `comisiones_devengadas`, `liquidaciones_comision` ni `embarque_garantias_contenedor`.

Pero el código ya filtra por ella:
- `src/features/comisiones/services/devengadas.ts:53` → `.is("deleted_at", null)` sobre `comisiones_devengadas`
- `src/features/embarques/services/garantias.ts:13` → `.is("deleted_at", null)` sobre `embarque_garantias_contenedor`

Esas dos consultas hoy fallan con error de columna inexistente (42703): el tab de Garantías del embarque y las comisiones devengadas no cargan datos.

Además, en `src/features/tesoreria/services/conciliacion.ts` solo 1 de las 5 consultas a `bbva_movimientos` (línea 101) filtra borrados; faltan las de las líneas 69, 127, 149 y 164.

## Plan de corrección

1. **Migración nueva** (idempotente, bloque `DO` con `ADD COLUMN IF NOT EXISTS`):
   - `deleted_at timestamptz` + `deleted_by uuid` + índice parcial en `comisiones_devengadas`, `liquidaciones_comision`, `embarque_garantias_contenedor`.
   - Sin tocar policies ni la papelera (`is_soft_delete_table`): queda documentado como follow-up en el encabezado de la migración.
2. **Regenerar tipos** de la base y verificar que `types-drift` queda limpio.
3. **Completar los filtros** de `deleted_at` en las 4 consultas restantes de `conciliacion.ts`.
4. **Tests**: unit tests que verifiquen que las consultas de garantías, comisiones y conciliación incluyen el filtro; y actualizar cualquier mock afectado.
5. **CI**: correr tests de las features tocadas, `audit:migrations`, `typecheck` y lint.
6. **CHANGELOG + `APP_VERSION`** (`13.331.3`).

## Detalles técnicos

- La migración usa el bloque de timestamp acordado del paquete (`20260730300xxx`), con nombre `YYYYMMDDHHMMSS_<uuid>.sql`.
- El índice único `proveedores_org_rfc_unique` ya es parcial con `deleted_at IS NULL`, así que ese punto de M6 no requiere cambios.
- El listado por RPC `proveedores_listado` sigue sin filtro server-side de borrados; queda fuera de alcance de M6 (paquete de altos), y lo señalo como pendiente conocido.
