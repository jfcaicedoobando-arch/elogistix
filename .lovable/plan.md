# Plan — Sprint 1 (R3)

Sigo el orden obligatorio del documento: **Sprint 1 completo primero** en dos PRs lógicos. Después esperamos aprobación para Sprints 2–4.

## Analogía
El guard actual funciona como un cajero que sólo verifica *cuánto más* estás depositando en una cuenta con límite, no *cuánto quedará en total*. Si ya había 1000 y quieres subir a 2500, revisa el "+1500" contra el saldo restante — pero el saldo restante ya está inflado porque excluye tu pago viejo. Resultado: puedes rebasar el tope por el monto viejo. El fix cambia la comparación a "cuánto quedará en total".

## Cambios

### 1.1 FIX-R3-01 — Corregir path UPDATE de `guard_pago_proveedor`
- **Migración nueva** en `supabase/migrations/` con el `CREATE OR REPLACE FUNCTION public.guard_pago_proveedor()` exacto del documento (líneas 32–100): elimina el bloque `v_delta` y valida `NEW.monto_en_moneda_factura > v_saldo + 0.005` directo, ya que `v_pagos` excluye `NEW.id` para INSERT y UPDATE.
- Sincronizar la fuente canónica en `supabase/schema/cxp/` (mismo cuerpo).
- No cambia nombre ni firma → `schema-invariants.sql` no requiere ajuste.

### 1.2 Tests conductuales SQL (mitad pendiente del 0.2)
- Crear `supabase/tests/cxp_guard_sobrepago.sql` con 4 casos DO/ASSERT:
  1. INSERT pago > total → SQLSTATE 23514.
  2. INSERT válido → pasa y `monto_en_moneda_factura` poblado.
  3. UPDATE 1000→2500 en factura 3000 con otro pago 1000 → 23514 (el bug 1.1).
  4. UPDATE legítimo dentro de saldo → pasa.
- Cablear en `.github/workflows/rls-tests.yml` con otra línea `$PSQL -f supabase/tests/cxp_guard_sobrepago.sql`, junto a `schema-invariants.sql`.

### 1.3 Ban `@/features/**` desde `src/lib/**` (cierre de 0.5)
- Editar `eslint.config.js` bloque `src/lib/**` (~L432–452): añadir patrón `@/features/**` a `no-restricted-imports`.
- **Allowlist ARCH-DEBT** con los 12 archivos actuales que ya importan features desde lib (los enumero al implementar tras un `rg` para asegurar la lista exacta; el documento R2 N1 los identifica: `lib/contexts/auth/useAuthProfile.ts`, `useLoginAudit.ts`, `useAuthSession.ts`, `OrganizationContext.tsx`, `lib/filenames.ts`, `lib/ui/uiMappings.ts`, `lib/ui/appFeedback.ts`, `lib/csv/leadsCsv.ts`, `lib/query/index.ts`, etc.).
- **No** migrar esos 12 archivos en este ítem — sólo cerrar la puerta a nuevos.

## Detalles técnicos
- La corrección clave: `v_pagos` filtra `id <> COALESCE(NEW.id, ...)`, así excluye la fila en juego para ambos paths, y comparamos `NEW.monto_en_moneda_factura` (post-conversión) contra `v_saldo`. Preserva `FOR UPDATE`, fórmula de diferencial cambiario, y NCs `Aplicada`.
- Estructura de la migración: encabezado con comentario del bug, `CREATE OR REPLACE FUNCTION` (mismo owner/SECURITY DEFINER/search_path), sin drops adicionales.
- El test SQL usa una organización + proveedor + factura de fixture en un `BEGIN … ROLLBACK` para no ensuciar datos.

## Orden de PRs
- **PR-A**: 1.1 + 1.2 juntos (fix con su test de regresión).
- **PR-B**: 1.3 aparte (cambio de lint aislado).

## Checklist de humo (Sprint 1)
1. UPDATE de pago que excede saldo → `LC_PAGO_EXCEDE_SALDO`.
2. UPDATE legítimo pasa.
3. INSERT sobrepago falla; INSERT válido pasa.
4. `cxp_guard_sobrepago.sql` verde en CI.
5. `schema-invariants.sql` verde.
6. `bun run lint`, `tsgo`, `vitest`, `knip` verdes; el ban 1.3 no añade violaciones fuera de la allowlist.

## Version bump
- `APP_VERSION` → `13.309.38`
- Entrada en `CHANGELOG.md` describiendo FIX-R3-01, test conductual y ban lib→features.

## Fuera de alcance (Sprints 2–4)
No tocar en este PR: paridad roleHierarchy, refactor de `EmbarqueDetalleHeader`, ciclos runtime, PR-6 formularios, status registry, etc. Los aplicaré en órdenes siguientes tras aprobación.
