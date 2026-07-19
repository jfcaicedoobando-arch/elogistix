# Fase O — Validaciones de cuadre y consistencia al aprobar CxP (Bug 23)

Fase N verificada en verde (14/14 tests). Continuamos con Bug 23: hoy `aprobar_factura_proveedor` sólo revisa rol y estado; permite aprobar facturas cuyos **conceptos no cuadran contra el total**, cuyo **embarque está cancelado**, o cuyo **UUID SAT no ha sido verificado**. Esto contamina reportes de rentabilidad y "hueco de facturación".

## Objetivo
Convertir la aprobación en una compuerta contable: sólo pasa si los datos son consistentes.

## Cambios

### 1. Base de datos (nueva migración `v13.301.86`)

**Función helper `public._cxp_validar_aprobacion(factura_id uuid)`** (SECURITY DEFINER, sólo lectura):
- **Cuadre**: si la factura tiene ≥1 concepto en `proveedor_facturas_conceptos`, exige `|SUM(monto·cantidad) − subtotal| ≤ 0.01` en la misma moneda de la factura. Si `estado_captura = 'pendiente'` / sin conceptos, se rechaza con código `LC_CXP_SIN_CONCEPTOS` para forzar captura antes de aprobar.
- **Embarque**: si `embarque_id IS NOT NULL`, valida que el embarque exista, no esté `Cancelado`, y `organization_id` coincida. Códigos: `LC_CXP_EMBARQUE_CANCELADO`, `LC_CXP_EMBARQUE_ORG_MISMATCH`, `LC_CXP_EMBARQUE_NO_EXISTE`.
- **UUID SAT**: si `uuid_fiscal IS NOT NULL`, exige `uuid_verificado = true`. Código `LC_CXP_UUID_NO_VERIFICADO`.
- Devuelve `void`; lanza `RAISE EXCEPTION` con los códigos anteriores como prefijo del mensaje.

**Modificar `aprobar_factura_proveedor`**:
- Justo después del check de estado (`v_row.estado_aprobacion <> 'pendiente'`) y **sólo cuando `p_aprobar = true`**, invoca `PERFORM public._cxp_validar_aprobacion(p_id)`.
- Rechazo (`p_aprobar = false`) sigue sin restricciones — se puede rechazar aunque los datos no cuadren.

**Grants**: `EXECUTE` de `_cxp_validar_aprobacion` sólo a `authenticated` y `service_role`; revocar de `PUBLIC` y `anon`.

### 2. Cliente (`aprobacionFactura.ts`)
- Extender `ERROR_RULES` con 4 nuevos códigos y mensajes en español mexicano:
  - `LC_CXP_SIN_CONCEPTOS` → "Captura los conceptos de la factura antes de aprobar."
  - `LC_CXP_DESCUADRE` → "Los conceptos no cuadran con el subtotal de la factura. Revisa la captura."
  - `LC_CXP_EMBARQUE_CANCELADO` → "El embarque asociado está cancelado. No se puede aprobar esta factura."
  - `LC_CXP_UUID_NO_VERIFICADO` → "Verifica el UUID en el SAT antes de aprobar."
- Sin cambios de UI; los toasts existentes muestran `error.message`.

### 3. Tests
- **Guardrail SQL** `src/lib/__tests__/cxp-aprobacion-consistencia-fase-o.test.ts` (~8 asserts):
  1. `_cxp_validar_aprobacion` existe y es `SECURITY DEFINER`.
  2. `aprobar_factura_proveedor` invoca `_cxp_validar_aprobacion` sólo si `p_aprobar`.
  3. `EXECUTE` revocado de `PUBLIC` / `anon`.
  4. Grant a `authenticated` y `service_role`.
  5. Función revisa cuadre `subtotal` vs conceptos con tolerancia 0.01.
  6. Función revisa embarque cancelado.
  7. Función revisa `uuid_verificado` cuando hay `uuid_fiscal`.
  8. Rechazo (`p_aprobar=false`) omite validación.
- **Unit test** `aprobacionFactura.test.ts`: extender con casos de los 4 nuevos códigos → mensaje amigable correcto.

### 4. Bitácora y CHANGELOG
- Bump `APP_VERSION` a `13.301.86`.
- Entrada en `CHANGELOG.md` describiendo Bug 23 remediado.

## Verificación
```
bun run ci:fast
```
Debe quedar todo verde y las 14 pruebas L+M+N seguir pasando junto con las nuevas de Fase O.

## Fuera de alcance
- Backfill de facturas ya `aprobada` con datos inconsistentes → se reporta pero no se re-abre automáticamente (evitar efectos colaterales en reportes históricos).
- Cuadre a nivel `total` incluyendo IVA/IEPS → se hará en Fase P junto con matching parcial y anticipos.
