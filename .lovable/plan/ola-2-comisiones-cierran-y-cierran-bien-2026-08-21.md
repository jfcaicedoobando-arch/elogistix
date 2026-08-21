# Ola 2 — Comisiones cierran y cierran bien

## Qué está pendiente (verificado hoy contra la base y el código)

Los 11 puntos del documento siguen abiertos. Los que importan:

- **O2.1 · Comisión duplicada (P0, dinero real).** El prorrateo sigue dividiendo entre el total de *una factura*, mientras la utilidad es del *embarque completo*. Hay **18 embarques con más de una factura** con comisión viva: ahí la comisión se pagó (o se pagará) de más. Es el único hallazgo con dinero mal calculado hoy.
- **O2.2 · Cierre bloqueado.** `validar_cierre_embarque` exige comisiones `definitiva = true`, pero esa bandera sólo se pone *al cerrar*. Círculo vicioso: todo cierre necesita "forzado admin".
- **O2.3 · Nota de crédito no baja la comisión.** No existe ningún disparador de notas de crédito hacia comisiones (confirmado: los 6 triggers de la tabla son de moneda, transición, saldo y estado de factura).
- **O2.4 · Factura consolidada = comisión 0 silenciosa.** La función no consulta el puente factura↔embarques.
- **O2.5 · Anticipo a proveedor sin llave de idempotencia.** Doble clic = doble anticipo y doble cargo bancario conciliado.
- **O2.6 · Liquidaciones sin ciclo de vida.** La tabla no tiene `estado` y el registro de pago es un update plano sin candado: se puede pagar dos veces.
- **O2.8 · El auto-sync de estado brinca el control de documentos** (escribe el estado directo, sin pasar por la RPC con sus validaciones).
- **O2.9 / O2.10 / O2.11 · Pendientes menores:** cotización que no se vence sola, embarque enviado a papelera que deja la cotización colgada, y tres tareas programadas que faltan.

## ¿Vale la pena terminarla?

Sí, pero por partes. La analogía: O2.1 y O2.2 son una fuga de agua y una puerta trabada — se arreglan ya. El resto son goteras y bisagras que rechinan: importantes, no urgentes.

Recomendación: **cerrar O2.1 + O2.2 + O2.5 + O2.6 ahora** (dinero e integridad), y dejar O2.3/O2.4/O2.8/O2.9/O2.10/O2.11 para una Ola 2b.

## Fase A — Dinero y cierre (lo que propongo hacer primero)

1. **O2.1 · Prorrateo correcto.** Cambiar el denominador a la venta total del embarque en pesos (misma cascada de tipo de cambio que ya usa el sistema), restando notas de crédito aplicadas. Reporte de sólo lectura para los 18 embarques afectados y una guarda que impida que la suma de proporciones de un embarque pase de 1.
2. **O2.2 · Regla de cierre satisfacible.** Reemplazar "todas definitivas" por "no hay comisiones devengadas marcadas como pendientes ni filas en la cola de recálculo", ignorando canceladas y borradas. El bloqueo útil (comisión sin tipo de cambio) se conserva.
3. **O2.5 · Idempotencia del alta de anticipo.** Llave `p_request_id` en la RPC (patrón ya usado en pagos) y llave estable por apertura del diálogo en la pantalla.
4. **O2.6 · Liquidaciones con estado.** Columna `estado` (Generada/Pagada/Cancelada), candado "sólo si no está pagada" al registrar el pago, y acción de cancelar con motivo.

Cada punto va con su prueba SQL de regresión en `supabase/tests/` y queda registrado en el CHANGELOG.

## Fase B — Ola 2b (después, si lo apruebas)

O2.3 (nota de crédito reduce comisión — requiere decidir con finanzas qué pasa si ya se liquidó), O2.4 (facturas consolidadas), O2.8 (auto-sync por la RPC), O2.9, O2.10 y O2.11 (tareas programadas).

## Detalle técnico

- `public.calcular_comision_pago`: nuevo denominador `v_venta_embarque_mxn` (Σ `conceptos_venta` convertidos) − NC aplicadas; ruteo a `comisiones_recalculo_pendiente` cuando no se pueda resolver.
- `public.validar_cierre_embarque`: regla `comisiones_definitivas` redefinida sobre `estado='Devengada' AND nota IS NOT NULL` + `NOT EXISTS` en `comisiones_recalculo_pendiente`.
- `public.registrar_anticipo_proveedor`: firma con `p_request_id uuid DEFAULT NULL`, `idempotency_claim`/`idempotency_store`; frontend `cxp/services/anticipos.ts` + `RegistrarAnticipoDialog` con `useStableRequestId`.
- `public.liquidaciones_comision`: `estado` con default `'Generada'`, guard `WHERE fecha_pago IS NULL` en `registrarPagoLiquidacion`, error `LC_LIQUIDACION_YA_PAGADA`.
- Espejos en `supabase/schema/` actualizados en el mismo cambio (guardrail `audit:replay-mirror`) y nuevos códigos registrados en el catálogo `LC_*`.
