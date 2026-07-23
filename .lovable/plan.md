
## Alcance

Aplicar **Bloque 0** (crítico) de `instrucciones-lovable-arquitectura-r2.md`. Bloques 1-3 se dejan como iteraciones posteriores — este plan sólo cubre lo que la auditoría marca como "va primero, solo, y se mergea antes que cualquier otra cosa".

Trabajo agrupado en 3 tandas / PRs, en orden obligatorio.

---

### PR-A · Bug de dinero CxP + tests (0.1 + 0.2)

**Problema real:** El guard `tg_pagos_proveedor_no_sobrepago` corre antes que el trigger de conversión, y la app no manda `monto_en_moneda_factura` → el guard ve NULL y retorna temprano. **Se están aceptando sobrepagos en producción.**

1. Leer cuerpos actuales de los 2 triggers (migraciones `20260722220926` conversión y `20260723051800` guard) y de `convertir_monto_pago_a_factura` para preservar EXACTAMENTE la lógica de diferencial cambiario.
2. Migración nueva: drop de los dos triggers viejos + funciones; crear `guard_pago_proveedor()` unificada que:
   - hace `SELECT ... FOR UPDATE` sobre la factura (paridad con FIX-R4-04 de CxC),
   - llama a `convertir_monto_pago_a_factura` primero (sin fallback de TC),
   - recalcula diferencial cambiario con la misma fórmula actual,
   - valida sobrepago sumando pagos vivos (excluye cancelados y el propio row en UPDATE),
   - lanza `LC_PAGO_EXCEDE_SALDO` con SQLSTATE 23514.
3. `REVOKE ALL ON FUNCTION ... FROM PUBLIC`. Registrar en `supabase/schema/cxp/`.
4. Actualizar `supabase/tests/schema-invariants.sql`: retirar los 2 triggers viejos, añadir `trg_pagos_proveedor_guard` + `guard_pago_proveedor`.
5. Repointear `src/lib/__tests__/cxp-multimoneda-fase-l.test.ts:67-73` al nuevo guard (`LC_PAGO_EXCEDE_SALDO`).
6. Añadir test conductual SQL nuevo en `supabase/tests/` con 3 casos: INSERT sin `monto_en_moneda_factura` que excede total → 23514; pago válido → convierte y pasa; UPDATE que excede → falla.
7. Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

**Riesgo alto** — dinero. Antes de mergear, ejecutar el checklist de humo del ítem 0.1 en dev (pago que excede, pago exacto, USD→MXN sin TC, dos pagos concurrentes).

---

### PR-B · Capa LC_ cableada (0.3)

1. En `src/hooks/shared/useMutationWithFeedback.ts` (~L175) sustituir `err?.message` por `getErrorMessage(err)`. Un solo punto de traducción — dejar los `notifyError` directos como están para no traducir dos veces.
2. Corregir comentario obsoleto en `src/features/embarques/hooks/mutations/useEstadoEmbarque.ts:78-79`.
3. Reemplazar los regex manuales de `src/features/cotizacion/services/conversiones/portal.ts:26-36` por `translateLcCode`.
4. Añadir al catálogo `lcCodeMessages.ts`: `LC_FACTURA_CON_REP_VIVO`, `LC_MOVIMIENTO_YA_VINCULADO`.
5. Nuevo test de deriva: grep `LC_[A-Z_0-9]+` de `supabase/migrations` + app-raised, asertar que todos existen como keys en `LC_CODE_MESSAGES`.
6. Bump + CHANGELOG.

---

### PR-C · Wiring CI + grants + guard de capa (0.4 + 0.5)

1. **CI**:
   - `.github/workflows/rls-tests.yml`: añadir línea `$PSQL -f supabase/tests/schema-invariants.sql` tras aplicar migraciones.
   - `.github/workflows/ci.yml` (job audits): añadir `npm run audit:migrations` y `npm run audit:schema`.
2. **Baseline de audit**: en `scripts/audit-migrations.*` cambiar la regla del baseline `20260723180000` para que exima sólo archivos **anteriores al día** del baseline (no del mismo día); H6 (SECURITY DEFINER sin REVOKE/GRANT) dura para funciones re-creadas después del baseline.
3. **Migración chica de grants** (puede acompañar al PR-A si conviene, pero listada aquí):
   - `snapshot_cotizacion_al_enviar`: anclar `REVOKE ALL FROM PUBLIC`.
   - `_calcular_demoras_montos_contenedor` (`20260723165250:66`): añadir `GRANT ... TO service_role` para alinear con los otros 4 helpers.
4. **ESLint hueco `src/lib/**`**: en `eslint.config.js:432-452` añadir `@/features/**` a `no-restricted-imports` con allowlist `ARCH-DEBT` para los 12 archivos actuales listados por la auditoría. **No migrar los 12** en este PR — sólo cerrar la puerta.
5. Bump + CHANGELOG.

---

## Fuera de alcance de este plan

- Bloque 1 (paridad roleHierarchy, header 33 props, ciclos runtime, complejidad) — siguiente iteración.
- Bloques 2 y 3 (RHF de forms CxP, status registry, dead code, jscpd, docs) — posterior.
- No se migran los 12 archivos con deuda `lib/**→features/**`; sólo se cierra la puerta con allowlist.

## Verificación por PR

- `bun run lint -- --max-warnings 0`, `npx tsgo -b`, `npx vitest run`, `npx knip` verdes.
- PR-A adicional: checklist de humo manual en dev (los 4 escenarios de pago).
- PR-C adicional: correr los workflows en un branch de prueba para confirmar que `schema-invariants.sql` y `audit:migrations` fallan cuando deben.

## Nota

El repo ya tiene `.lovable/` en `.gitignore`, así que este plan no persiste tras el snapshot. ¿Quitamos esa entrada del `.gitignore` antes de aprobar, para conservarlo?
