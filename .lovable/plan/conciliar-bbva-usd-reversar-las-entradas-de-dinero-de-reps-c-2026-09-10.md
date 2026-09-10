# Conciliar BBVA USD: reversar las entradas de dinero de REPs cancelados

## Qué encontré (verificado en la base)

En la cuenta **BBVA USD** hay **21 entradas de dinero por 257,480.20 USD**, todas con fecha 31/08/2026 y concepto "Cobro factura F10xx — INDIMEX TRADING". Datos confirmados:

- Ninguna viene del estado de cuenta del banco: las creó el sistema al registrar cada cobro (llevan la marca interna `cobro-<pago>`), el 08/09/2026.
- Los 21 cobros correspondientes tienen su REP **cancelado** ante el SAT y ya están anulados en el sistema (no cuentan para saldos ni cartera).
- Las 21 entradas siguen marcadas como **Conciliado** y ligadas a esos pagos anulados, así que el saldo de BBVA USD está inflado en 257,480.20 USD.

Como el dinero no entró, esas 21 entradas deben reversarse.

## Qué se va a hacer

1. **Reversar las 21 entradas** de BBVA USD: quedan canceladas y fuera del saldo y de la conciliación, pero el registro se conserva (no se borra nada de forma definitiva) y queda anotado en la bitácora con el motivo "REP cancelado: el cobro se anuló".
2. **Automatizarlo a futuro**: cuando un REP quede cancelado (por la revisión automática cada 30 minutos, por la actualización manual ante el SAT o a mano), la entrada de dinero que el sistema había creado para ese cobro se reversa sola, con su nota de motivo.
3. **Sólo se reversan entradas creadas por el sistema.** Si la entrada vino del estado de cuenta real del banco (dinero que sí llegó), no se cancela: se desvincula del pago anulado y vuelve a **Pendiente** para que tesorería la aplique al cobro correcto.
4. **Verificar el resultado**: revisar el saldo de BBVA USD después de la reversa y reportar si quedan otras cuentas con el mismo caso, sin tocarlas sin tu autorización.

## Lo que no se toca

Facturas, importes, IVA, REPs, comisiones, pagos (siguen visibles como "Anulado" con su historia), permisos ni otras cuentas bancarias.

## Detalle técnico

- Migración con una función `public.reversar_movimiento_cobro_rep_cancelado(p_pago_id uuid)` (`SECURITY DEFINER`, `search_path=public`):
  - toma el movimiento vivo con `pago_factura_id = p_pago_id`;
  - si `hash_dedupe` empieza con `cobro-` → soft-delete (`deleted_at`, `deleted_by`, `motivo_ignorar` = motivo) sin alterar `abono`/`cargo` (candado de inmutabilidad bancaria);
  - si no → `pago_factura_id = NULL`, `estado_conciliacion = 'Pendiente'`, `conciliado_at/por = NULL`;
  - registra en `bitacora_actividad` módulo `tesoreria`.
- Trigger `AFTER UPDATE OF estado_rep ON pagos_factura` que invoca la función cuando `NEW.estado_rep = 'Cancelado'` y el anterior no lo era; idempotente (si el movimiento ya está reversado, no hace nada). Se respeta `_bbva_guard_update` — la función corre como definer y no cambia importes.
- Migración de datos que ejecuta la función para los 21 pagos con `estado_rep='Cancelado'` que hoy tienen movimiento vivo.
- Espejo en `supabase/schema/baseline.sql` + `bun run db:release-manifest:update`.
- Pruebas focalizadas del servicio/estado de conciliación afectado y verificación por consulta del saldo de la cuenta.
- Cierre: `CHANGELOG.md` + `APP_VERSION` a `13.823.293`.

## Validación local

typecheck, ESLint focalizado, pruebas focalizadas de tesorería, `audit:manifest`, `db:postcheck` y build. CI, RLS y E2E completos quedan para GitHub Actions.
