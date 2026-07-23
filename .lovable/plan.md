## Objetivo
Correr en modo build una **verificación exhaustiva** contra la auditoría del 2026-07-23 y producir un reporte de estado real — sin refactorizar nada todavía. El reporte alimenta la decisión de qué ítems atacar después.

## Alcance
Sólo ejecutar chequeos existentes en el repo y comparar contra los 4 bloques del documento. Cero cambios de código, cero migraciones. Un solo commit final: `docs(arquitectura) · reporte estado auditoría-3` con el reporte en `docs/arquitectura-auditoria-3-status.md`.

## Pasos

1. **Correr suite CI en frío** (sin cache), capturando stdout/stderr a `/tmp/audit3/`:
   - `bun run lint -- --max-warnings 0`
   - `bunx tsgo --noEmit`
   - `bunx vitest run` (todos los shards)
   - `bunx knip`
   - `bunx madge --circular --extensions ts,tsx src/` → capturar número exacto de ciclos.
   - `bunx tsx scripts/audit-arch.ts` (o equivalente vigente) → capturar oversized/violations.
   - `scripts/ci-fast.sh` si existe.

2. **Verificar cada ítem del documento** contra el código actual con `rg`/`sed`/`grep`, marcando ✅/⚠️/❌:

   Bloque 1 (1.1 scanner · 1.2 path eslint · 1.3 tipos cxp · 1.4 anys · 1.5 AuthContext · 1.6 supabase en tsx)
   Bloque 2 (2.1 lcCodeMessages · 2.2 schema-invariants · 2.3a shared · 2.3b eslint · 2.4 IVA/fases)
   Bloque 3 (3.1 canónicos · 3.2 god functions · 3.3 formularios RHF · 3.4 formatters/StatusBadge · 3.5 prop-drilling tabs · 3.6 higiene migraciones · 3.7 coverage/SQL LC_ · 3.8 catch vacíos)
   Bloque 4 (7 sub-ítems boy-scout)

3. **Medir hotspots residuales** con conteos duros:
   - `toLocaleString`/`Intl.NumberFormat`/`toLocaleDateString` fuera de `src/lib/formatters/`
   - `estado === "Literal"` fuera de constantes `ESTADOS_*`
   - Archivos > 200 líneas, > 300 líneas, > 500 líneas (top 20)
   - Funciones con complejidad ciclomática > 16 (via eslint report json)
   - `useState` en hooks `useNueva*Form.ts` (Bloque 3.3)
   - CFDI de la allowlist `CROSS_FEATURE_ALLOWLIST` en `eslint.config.js` (baseline: 54)

4. **Escribir el reporte** en `docs/arquitectura-auditoria-3-status.md` con:
   - Tabla por ítem: estado ✅/⚠️/❌ + evidencia (comando/archivo:línea) + esfuerzo estimado (S/M/L)
   - Números duros de la suite CI (tests pasados, warnings, ciclos madge, oversized, knip)
   - Lista ordenada de "trabajo real pendiente" priorizado por riesgo × esfuerzo
   - Recomendación de siguiente PR (1–3 candidatos concretos)

5. **Actualizar** `CHANGELOG.md` (entrada `docs`) y bumpear `APP_VERSION` a `13.309.20`.

## Detalles técnicos

- Los logs completos van a `/tmp/audit3/*.log` (no se comitean); el reporte cita `archivo:línea` y comandos reproducibles.
- Si algún chequeo falla (lint/tsgo/vitest en rojo), NO se corrige en este PR — se documenta en el reporte como bloqueo y se detiene.
- Para complejidad ciclomática, usar `bunx eslint . --format json --rule '{"complexity":["error",16]}' --no-eslintrc` sobre `src/` y parsear top 20.
- Para conteo de `estado === "Literal"`: `rg -n "estado\s*===\s*\"" src --type ts --type tsx | grep -v "ESTADOS_"`.

## Riesgo / Reversibilidad
Riesgo cero — sólo lectura + un archivo de documentación nuevo. Reversible con revert del commit.

## Fuera de alcance
Todo refactor de código (Bloques 1–4 del documento). Cualquier cambio en `src/`, `supabase/`, o `scripts/` fuera de la creación del reporte.
