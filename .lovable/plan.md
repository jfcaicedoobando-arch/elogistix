## Objetivo

Corregir un bug P0 introducido en el Bloque A antes de continuar con el Bloque B. Todo lo demás del Bloque A se auditó y quedó consistente.

## El bug

El nuevo trigger `guard_estado_proveedor_factura` (FIX-R2-04) impide que una factura de proveedor salga del estado `Pagada` salvo que la sesión tenga `app.recalc_cxp = '1'`. Pero la función `_recalc_estado_proveedor_factura` (Fase N, migración `20260719032603`) — que corre automáticamente después de cada movimiento de `pagos_proveedor` y `proveedor_notas_credito` — hace exactamente esa transición (Pagada → Vigente) cuando el saldo vuelve a subir, y **no** setea esa marca de sesión.

Consecuencia: hoy fallan con `LC_CXP_PAGADA_INMUTABLE` flujos legítimos como:
- Borrar/anular un pago aplicado a una factura Pagada.
- Aplicar/cancelar una NC de proveedor sobre una factura Pagada.
- Cualquier ajuste cambiario/soft-delete que reabra saldo.

## Cambios

Una sola migración correctiva, sin tocar el guard ni tocar código de la app.

### 1. Marcar la ventana de recálculo como confiable

Modificar `public._recalc_estado_proveedor_factura(uuid)` para envolver su `UPDATE` con `set_config('app.recalc_cxp','1', true)` antes y `set_config('app.recalc_cxp','0', true)` después (mismo patrón que ya usa `cancelar_factura_proveedor` con `app.cancelando_cxp`).

Con esto, el guard sigue rechazando transiciones directas hechas desde código de app o SQL manual, pero deja pasar el recálculo interno del propio motor.

### 2. Test manual de regresión

Después de aplicar la migración, verificar en el entorno:

1. Crear factura proveedor, pagarla completa → estado `Pagada`.
2. Soft-delete del pago → debe volver a `Vigente` sin lanzar `LC_CXP_PAGADA_INMUTABLE`.
3. Registrar un nuevo pago parcial → debe quedar `Vigente` (o `Parcial` si aplica).
4. Registrar segundo pago que salde → debe volver a `Pagada`.
5. Intentar `UPDATE proveedor_facturas SET estado='Vigente'` a mano sobre una Pagada → debe seguir fallando con `LC_CXP_PAGADA_INMUTABLE` (confirma que el guard sigue vivo).

### 3. Bump de versión y changelog

- `APP_VERSION` → `13.305.14`.
- Entrada en `CHANGELOG.md`: "Fix hotfix Bloque A: recálculo automático de estado CxP ya no colisiona con el guard `LC_CXP_PAGADA_INMUTABLE`."

## Detalle técnico

```text
Antes:                              Después:
recalc → UPDATE estado              recalc → SET app.recalc_cxp='1'
       → guard bloquea                    → UPDATE estado
                                          → guard permite (marca ok)
                                          → SET app.recalc_cxp='0'
```

El scope de `set_config(..., true)` es transaccional/local, así que la marca se limpia sola al terminar la transacción incluso si algo aborta. No se abre ventana de escritura no auditada desde la app porque solo se aplica dentro de esta función `SECURITY DEFINER` interna.

## Fuera de alcance

- Bloque B (P1: 13 fixes) — se ejecuta después de que este parche esté verde.
- Cambios en la app (frontend/edge functions): ninguno.
