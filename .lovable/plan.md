# Plan: aplicar `instrucciones-sprint-3.md`

El doc tiene 4 partes (A/B/C/D). Propongo ejecutar **A + B** en este PR (cierre real de Sprint 2). **C (Sprint 3)** y **D (Sprint 4)** quedan como PRs independientes por tamaño.

## Parte A — Artefactos listos (validados por el auditor)

1. **`arch-roots-lib.diff`** → `scripts/lib/arch.ts`
   - Añadir `CLIENT_IMPORT_ALLOW` (`lib/auth/signOut.ts`, `lib/auth/changePassword.ts`).
   - Ampliar `hooksContextsDirectImports` de `src/lib/contexts` → `src/lib` completo.
   - Verificar: `bun run audit:arch` sigue en 0 violaciones nuevas.

2. **`dead-code-cleanup.diff`** → borrar 12 barrels muertos:
   - `src/features/{auditoria,cliente,cotizacion,crm,cxp,embarques,facturacion,portal,proveedor,tesoreria}/index.ts`
   - `src/features/crm/domain/index.ts`
   - `src/components/ui/icon.tsx`
   - Limpiar `knip.json` (quitar `src/features/*/index.ts` y `src/features/crm/domain/index.ts` del `ignore`).
   - **Riesgo:** verificar con `rg` que no haya importadores antes de borrar cada uno (el diff dice "0 importadores verificados", pero re-verifico).

3. **`guard_pago_proveedor.sql`** → copiar a `supabase/schema/cxp/guard_pago_proveedor.sql` (fuente canónica que faltaba tras FIX-R3-01).

## Parte B — Cierre Sprint 2

4. **Romper 2 ciclos runtime restantes:**
   - `auditoria/domain/ejecutivoAgregados.ts` ↔ `ejecutivoRanking.ts`: extraer `calcularRanking`, `diffHoras`, `TOP_N` a `ejecutivoRankingCore.ts` (módulo hoja).
   - `facturacion/services/facturapi.ts` ↔ `facturapiConsultar.ts`: mover `parseFunctionError` + `FacturapiError` a `facturapiErrors.ts` hoja.
   - Aceptación: `npx madge --circular src/` ≤ 15.

5. **Complejidad `warn` → `error`** en `eslint.config.js:249`:
   - Generar allowlist ARCH-DEBT de violadores actuales.
   - Override `complexity: warn` sólo para esa allowlist con comentario ARCH-DEBT (burn-down).
   - Si `useEmbarqueEstadoActions` (~27) y `useNuevoProveedorController` siguen >16, entran en allowlist (no bloqueamos merge).

## Verificación transversal

- `bun run lint -- --max-warnings 0`
- `bunx tsgo --noEmit`
- `bunx vitest run` (arch + audit-report tests)
- `bun run audit:arch` (verde)
- `bunx knip` (sin nuevos huérfanos)
- `npx madge --circular src/` (≤ 15)
- Bump `APP_VERSION` → `13.309.53` + entrada `CHANGELOG.md`.

## Fuera de scope (siguientes PRs)

- **Parte C (Sprint 3):** PR-6 RHF+zod en CxP forms, hidratación wizard, status registry Oleada 2, retrofit LC_ backend, clones jscpd.
- **Parte D (Sprint 4):** bans `Intl`/`sonner`, coverage flags, layout docs, políticas catches/SAFE-CAST, Prettier, react-hooks v7.

¿Arranco con A+B o prefieres que dividamos A y B en dos PRs separados?
