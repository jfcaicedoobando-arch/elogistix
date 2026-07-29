## Qué pasó (en analogía)

Un script de mantenimiento preguntó a la caja "¿cuánto debe esta factura?". Pero la caja, por una regla de seguridad, sólo responde si sabe a qué empresa perteneces — y el script corría sin identidad, así que la caja contestó "0" a todo. El script interpretó "0 = ya está pagada" y estampó el sello **PAGADA** en 83 facturas que en realidad nunca se cobraron. F964 es una de ellas.

## Alcance confirmado

- 184 facturas en estado `Pagada`; **83 sin ningún pago registrado**.
- Marcadas en 3 lotes automáticos: 72 (2026-07-22), 8 (2026-07-23), 3 (2026-07-07).
- Incluye F964, F950–F1004, folios legacy (658, 706…) y demos DLM.

## Plan de remediación

### 1. Migración de corrección de datos (idempotente)
Recalcular el estado real de cada factura viva usando aritmética directa (sin `saldo_factura`):
- `saldo = total − Σ pagos vivos − Σ NC aplicadas`
- `saldo <= 0.01` → Pagada · `pagado > 0` → Parcialmente pagada · `vencimiento < hoy` → Vencida · resto → Emitida
- Se excluyen `Cancelada`, `Sustituida`, `Borrador`.
- Se ejecuta con `set_config('app.recalc_estado_factura','1')` para pasar el guard `guard_estado_factura`.
- Deja registro en `bitacora_actividad` / `app_logs` con el conteo de facturas revertidas, para que Cobranza sepa qué revisar.

### 2. Blindar la función de saldo
`saldo_factura` seguirá siendo fail-closed para usuarios finales, pero debe distinguir "no hay usuario autenticado" (contexto de migración/cron/service_role) de "usuario de otra organización". Se agrega la condición de que el guard sólo aplique cuando `auth.uid() IS NOT NULL`, igual que ya hace la versión más reciente en producción — y se corrige el punto que aún deja pasar NULLs.

### 3. Guard-rail permanente contra este patrón
- Añadir a `scripts/db/integrity-guard.sql` un check bloqueante: **cero facturas en estado `Pagada`/`Parcialmente pagada` sin pagos ni NC que lo respalden**. Así, si otro backfill vuelve a equivocarse, CI lo detiene.
- Añadir regla al auditor de migraciones: prohibido usar funciones con guard de tenant (`saldo_factura`, `saldo_factura_bruto`, y similares) dentro de bloques `DO $backfill$`.

### 4. Visibilidad en la UI
En el detalle de factura, cuando el estado sea `Pagada` pero no exista historial de pagos, mostrar un aviso de inconsistencia en lugar de un badge verde silencioso.

### 5. Pruebas y cierre
- Test de la función de recálculo (pagada / parcial / vencida / emitida).
- Test del nuevo check de `integrity-guard`.
- Actualizar `CHANGELOG.md` y subir `APP_VERSION`.

## Detalles técnicos

- Archivos: nueva migración en `supabase/migrations/`, `scripts/db/integrity-guard.sql`, `scripts/audit-migrations.ts`, componente de detalle de factura en `src/features/facturacion/`.
- La corrección no borra ni crea pagos: sólo devuelve el estado a la realidad contable. Las facturas que sí tienen pago (como F963) no se tocan.
- Impacto esperado: ~83 facturas volverán a `Emitida` o `Vencida`, lo que hará que la cartera por cobrar refleje montos reales (hoy subestimados).
