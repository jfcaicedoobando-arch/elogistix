# Fase R.7 — Residual Fase B + bordes menores

Analogía: la Fase B libera la proforma cuando cancelas la factura MXN "buena", pero se olvida que hay un borrador USD en la despensa consumiendo los mismos conceptos. Al ver "vivas" ignora los borradores → la proforma vuelve a `pendiente`, y si la re-conviertes duplicas conceptos en el borrador USD. Fix simétrico al de Fase C: contar borradores como facturas vivas.

## Verificación previa (hecho)

- `supabase/migrations/20260718195258_...sql` línea 66: `WHERE f.estado NOT IN ('Cancelada','Sustituida','Borrador')` — confirmado.
- Fase C ya excluye sólo `('Cancelada','Sustituida')` al bloquear borrado del embarque.
- Test `src/lib/__tests__/revertir-proforma-multi-source.test.ts` usa regex `NOT IN ('Cancelada','Sustituida'` (no exige `Borrador`), así que el fix no lo rompe.

## Cambios

### 1. Fix principal — Bug 3 residual (CRÍTICO)

Nueva migración `supabase/migrations/<ts>_r7_revertir_proforma_cuenta_borradores.sql`:

- `CREATE OR REPLACE FUNCTION public.revertir_proforma_al_cancelar_sustitucion` idéntica a la actual **excepto**:
  - Línea 66 → `WHERE f.estado NOT IN ('Cancelada','Sustituida')` (quitar `'Borrador'`).
- Mantener firma `RETURNS uuid[]`, `SECURITY DEFINER`, `search_path = public`.
- `COMMENT ON FUNCTION` explicando que los borradores cuentan como vivos (consumen conceptos y pueden timbrarse).

### 2. Bug menor A — INSERT directo salta máquina de estados NC proveedor

Reforzar el trigger existente en `proveedor_notas_credito`:

- Recrear `enforce_nc_proveedor_estado_transicion()` para disparar también en `BEFORE INSERT`.
- En INSERT: si `NEW.estado` ∉ `('Borrador')`, `RAISE EXCEPTION 'LC_NC_PROV_INSERT_ESTADO_INVALIDO'` con `HINT` "Una nota de crédito debe crearse en estado Borrador".
- Trigger:
  ```sql
  DROP TRIGGER IF EXISTS trg_nc_prov_estado_machine ON public.proveedor_notas_credito;
  CREATE TRIGGER trg_nc_prov_estado_machine
    BEFORE INSERT OR UPDATE OF estado ON public.proveedor_notas_credito
    FOR EACH ROW EXECUTE FUNCTION public.enforce_nc_proveedor_estado_transicion();
  ```
- Cliente (`src/features/cxp/services/proveedorNotasCredito.ts`): mapear el nuevo token dentro de `mapEstadoError` a `NcProveedorTransicionInvalidaError` reutilizando el hint.

### 3. Bug menor B — Proformas en borrador no bloquean eliminar embarque

Actualizar `eliminar_embarque_completo` (revisada en Fase R.1):

- Ampliar el conteo de proformas bloqueantes de `estado_proforma IN ('aprobada','facturada')` a **cualquier `estado_proforma <> 'cancelada' AND deleted_at IS NULL`** (incluye `pendiente` y `borrador`).
- Mensaje sigue siendo `LC_EMBARQUE_CON_PROFORMAS_VIVAS` con lista de folios.
- Alternativa considerada (soft-delete cascada): descartada — dejaría facturas vacías si el usuario luego re-convertía; bloquear es más seguro.

### 4. Bug menor C — Soft-delete de proforma facturada solo en UI

Nuevo trigger en `proformas`:

- `enforce_proforma_no_soft_delete_facturada()` `BEFORE UPDATE OF deleted_at`:
  - Si `OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND OLD.estado_proforma = 'facturada'` → `RAISE EXCEPTION 'LC_PROFORMA_FACTURADA_NO_ELIMINABLE'`.
- Trigger `trg_proforma_no_soft_delete_facturada BEFORE UPDATE OF deleted_at ON public.proformas`.
- No hace falta cambio en cliente (la UI ya lo evita); el trigger es defensa en profundidad.

### 5. Tests

- `src/lib/__tests__/revertir-proforma-borrador-vivo.test.ts` (nuevo, estilo lectura de SQL como los existentes):
  - Verifica que la última definición de `revertir_proforma_al_cancelar_sustitucion` **NO** incluye `'Borrador'` en el `NOT IN`.
- `src/features/cxp/services/__tests__/proveedorNotasCredito.test.ts`:
  - Agregar caso: BD devuelve `LC_NC_PROV_INSERT_ESTADO_INVALIDO` en `crearNotaCreditoProveedor` con `estado='Aplicada'` → se mapea a `NcProveedorTransicionInvalidaError` (si no existe el archivo, crearlo con mocks del patrón thenable).
- `src/lib/__tests__/eliminar-embarque-proformas-borrador.test.ts` (nuevo, lectura SQL):
  - La última definición de `eliminar_embarque_completo` cuenta proformas con `estado_proforma <> 'cancelada'` (o equivalente que incluya `'borrador'`).
- `src/lib/__tests__/proforma-facturada-no-soft-delete.test.ts` (nuevo, lectura SQL):
  - Existe el trigger `trg_proforma_no_soft_delete_facturada` y el `RAISE EXCEPTION` con token esperado.

### 6. Versionado & changelog

- Bump `APP_VERSION` → `13.301.97`.
- `CHANGELOG.md`:
  ```
  ## [13.301.97] - 2026-07-19
  - Fase R.7 (Bug 3 residual): `revertir_proforma_al_cancelar_sustitucion` ahora cuenta borradores como facturas vivas — cancelar una factura ya no libera proformas si aún hay borradores consumiendo sus conceptos.
  - Fase R.7 (bordes menores): trigger `LC_NC_PROV_INSERT_ESTADO_INVALIDO` bloquea crear NC proveedor fuera de estado Borrador; `eliminar_embarque_completo` incluye proformas en borrador en el bloqueo; nuevo trigger `LC_PROFORMA_FACTURADA_NO_ELIMINABLE` evita soft-delete de proformas facturadas.
  ```

## Criterios de aceptación

1. Con factura MXN timbrada + borrador USD sobre la misma proforma, cancelar la MXN deja `estado_proforma = 'facturada'` (no `pendiente`).
2. `INSERT INTO proveedor_notas_credito (..., estado) VALUES (..., 'Aplicada')` falla con `LC_NC_PROV_INSERT_ESTADO_INVALIDO`.
3. Intentar eliminar un embarque con una proforma en borrador falla con `LC_EMBARQUE_CON_PROFORMAS_VIVAS`.
4. `UPDATE proformas SET deleted_at=now() WHERE estado_proforma='facturada'` falla con `LC_PROFORMA_FACTURADA_NO_ELIMINABLE`.
5. `bun run ci:fast` verde (los tests existentes de multi-source siguen pasando).
