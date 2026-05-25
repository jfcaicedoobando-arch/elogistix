# Loop 8 — Auditoría arquitectónica: barrels + mappers

Con el "Power of 10" (≤200 LOC) ya cerrado, este loop ataca los dos siguientes pendientes de mayor ROI del backlog en `mem://audit/pendings`.

## Objetivos

### P0.1 — Cerrar barrel violations (`no-restricted-imports`)
Hoy hay ~203 imports que apuntan a archivos internos en vez de al barrel del dominio. Esto rompe encapsulación y dificulta refactors futuros.

**Plan de ataque:**
1. Auditar `eslint` y agrupar las violaciones por dominio (`hooks/crm`, `hooks/embarque`, `services/embarque`, `services/auditoria`, `services/crm`, `lib/formatters`, `lib/csv`, etc.).
2. En cada dominio, asegurar que `index.ts` re-exporte la API pública completa (sin filtrar tipos ni utilidades que estén siendo consumidas).
3. Reemplazo mecánico de imports (`@/hooks/crm/leads/queries` → `@/hooks/crm`, `@/services/embarque/queries/paginados` → `@/services/embarque`, etc.).
4. Cuando un símbolo es estrictamente interno de un dominio, marcarlo como no exportado en el barrel y eliminar consumidores externos.
5. Subir `no-restricted-imports` de `warn` → `error` en `eslint.config.js` una vez en 0 (se anota para P2.12, no se hace aquí).

### P0.3 — Refactor de mappers de alta complejidad
Cuatro archivos con complejidad ciclomática crítica:
- `src/lib/mappers/embarqueFromDb.ts` (46)
- `src/lib/mappers/embarqueToDb.ts` (41)
- `src/lib/mappers/cotizacionForm.ts` (35)
- `src/lib/mappers/cotizacion.ts` (33)

**Patrón a aplicar en cada uno:**
1. `parseDb()` — valida la fila cruda de Supabase con un schema zod (tipos correctos + nullables).
2. `mapDbToDomain()` — función pura de transformación 1:1, sin lógica condicional defensiva (los nulls ya quedaron normalizados arriba).
3. `applyDefaults()` — defaults de negocio (estado inicial, moneda base, etc.), extraído a su propio módulo testeable.
4. Tests unitarios por cada función pura (input → output esperado) en `__tests__/`.

Cada archivo final ≤200 LOC, complejidad ≤12, con tests verdes.

## Out of scope
- P0.4 (disables de `exhaustive-deps`), P1.x (unificación utils, romper services god, schemas zod en queries), P2/P3 — quedan para loops siguientes.
- No tocar RLS, edge functions, ni `integrations/supabase/*`.

## Versionado
- `APP_VERSION` → **11.20.0** (cambios arquitectónicos significativos sin breaking changes funcionales).
- Entrada en `changelogData.ts` + `chunks/0.ts` manteniendo el límite de 10 recientes.
- Actualizar `mem://audit/pendings` marcando P0.1 y P0.3 como ✅.

## Verificación
- `bunx vitest run` (objetivo: 626+ tests, todos verdes; nuevos tests de mappers sumando ≥8).
- `bun lint` con 0 violaciones `no-restricted-imports` (vs 203 actuales).
- Build automático del harness.

## Riesgo
Cambios mecánicos extensos en imports → riesgo bajo pero amplio. Si el lote de barrels resulta demasiado grande para un solo loop, lo dividimos por dominio (CRM primero, luego embarque, luego el resto) y dejamos P0.3 para el siguiente.
