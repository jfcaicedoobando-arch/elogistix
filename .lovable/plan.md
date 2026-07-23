## Verificación de los bugs del documento R4-2

Contrasté cada fix contra la BD viva. Muchos ya están aplicados (con comentarios `FIX-R4-XX` en el propio código) o el diagnóstico es incorrecto. Detalle por bug:

### BLOQUE A — P0

**R4-01 · Triggers de recálculo "destruidos"** → **NO reproducible**
Existen los 3 triggers en `pagos_factura` / `factura_notas_credito`:
- `trg_recalcular_estado_factura` (AFTER INS/UPD/DEL)
- `trg_recalcular_estado_factura_nc`
- `trg_pagos_factura_calc_ret` (BEFORE)

La función `recalcular_estado_factura()` sí calcula `Pagada/Parcialmente pagada/Vencida/Emitida` a partir de `saldo_factura`. Sin un caso vivo que muestre "pago total y sigue Emitida", el bug no se sostiene.

**R4-02 · `convertir_proformas_a_factura` inutilizable** → **Diagnóstico obsoleto**
- Gate ya unificado: `es_escritor_financiero(auth.uid()) OR super_admin` (línea 41-46).
- Errcodes estables: `LC_PROFORMA_SIN_PERMISO` (P0001), `LC_PROFORMA_YA_FACTURADA` (P0002).
- Firma única, sin sobrecargas.
- Falta verificar el bloque de conceptos/moneda/bitácora del resto de la función.

### BLOQUE B — P1

**R4-03 · Margen mínimo lee `venta_mxn`** → **Falso en el detalle**
La función NO lee `venta_mxn`. Compara `utilidad_mxn >= v_margen_min` (líneas 171-183). El parche propuesto (cambiar a `venta.real_mxn`) no aplica. Puede haber un problema semántico si `pnl_margen_minimo_cierre` se configura como porcentaje y se compara contra pesos absolutos, pero eso requiere otra corrección.

**R4-04 · TOCTOU sin `FOR UPDATE`** → **YA CORREGIDO**
`tg_pago_factura_no_sobrepago` incluye `PERFORM 1 FROM facturas WHERE id = NEW.factura_id ... FOR UPDATE` con comentario `-- FIX-R4-04`.

**R4-05 · Retenciones no se prorratean** → **YA CORREGIDO**
`calc_pago_retenciones` usa `v_monto := COALESCE(NULLIF(NEW.monto_aplicado_factura,0), NEW.monto)` con comentario `-- FIX-R4-05`.

**R4-06 · Fallback silencioso al TC de la factura** → **Sin verificar**
Requiere leer `convertir_monto_pago_a_factura`. Plausible.

**R4-07 · `embarque_estado_financiero` sin NC** → **La vista no existe**
`pg_views` no reporta esa vista. Fue reemplazada o renombrada.

**R4-08 · Sobrecargas ambiguas** → **FALSO**
`crear_embarque_borrador_desde_cotizacion`, `actualizar_embarque_completo`, `generar_expediente` y `convertir_proformas_a_factura` tienen **una sola** firma cada una.

**R4-09 · `folio_secuencias` sin backfill** → **FALSO / no aplicable**
- `siguiente_folio_cotizacion(uuid)` no existe.
- Tabla `folio_secuencias` está vacía y su columna es `ultimo_numero`, no `valor`. El backfill propuesto ni siquiera compilaría.

**R4-10a · Fail-open en SEC DEFINER** → **PARCIALMENTE CIERTO**
- `saldo_factura` ya es fail-closed (`FIX-R4-10a`).
- `validar_cierre_embarque` **todavía** usa `v_caller_org IS NOT NULL AND ...` (línea 29-33): usuario sin membresía sí puede leer el JSON financiero. **Bug real.**

**R4-10b · `marcar_facturas_vencidas` cross-org** → **YA CORREGIDO**
Filtro `v_is_service OR super_admin OR organization_id = v_org` presente.

**R4-10c · REVOKE de `_recalc_estado_proveedor_factura`** → **Sin verificar**

### BLOQUE C — P2
Sin verificar todavía (R4-11 a R4-15).

---

## Conclusión y siguiente paso

De los 10 bugs de bloques A/B revisados: **2 ya corregidos con comentario `FIX-R4-XX`**, **3 con diagnóstico incorrecto**, **1 vista inexistente**, **1 sin sobrecarga real**, **1 backfill inaplicable**, **1 parcial (R4-10a en `validar_cierre_embarque`)**, **2 sin verificar (R4-06, R4-10c)** y **2 P0 sin caso reproducible** (R4-01, R4-02 sólo mitad).

Antes de aplicar cualquier migración, propongo:

1. **Confirmar reproducción real** de R4-01 (crear un pago total en staging y ver si la factura pasa a `Pagada`) y del bloque de conceptos/moneda de R4-02.
2. **Verificar los 7 pendientes** (R4-06, R4-10c, R4-11, R4-12, R4-13, R4-14, R4-15) contra el código actual antes de asumirlos.
3. **Aplicar sólo lo confirmado**: por ahora sólo el fail-closed en `validar_cierre_embarque` (R4-10a residual) parece un fix limpio con evidencia directa.

### ¿Cómo continuar?
- **Opción 1**: verifico y reproduzco los pendientes uno por uno y traigo un nuevo plan sólo con los bugs realmente vivos.
- **Opción 2**: aplico ya el fix acotado de R4-10a en `validar_cierre_embarque` y en paralelo verifico el resto.
- **Opción 3**: descartar el documento R4-2 como obsoleto y no tocar nada hasta que el auditor externo re-corra su suite contra el estado actual.

Recomiendo **Opción 1** para no reintroducir bugs con parches que asumen versiones viejas.
