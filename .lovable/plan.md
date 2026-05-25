# Cierre de cobertura P2

Continuamos con lo que quedó pendiente del audit (Tanda C parcial + edge functions sin tests).

## Alcance

### Edge functions Deno (sin tests hoy)

1. `supabase/functions/parse-csf` — validación de payload + parsing CSF
2. `supabase/functions/exchange-rates` — cache 1h, fallback Frankfurter
3. `supabase/functions/jsoncargo-track` — auth + shape de respuesta
4. `supabase/functions/tracking-public` — endpoint público, sin PII sensible
5. `supabase/functions/invite-client-user` — validación de input + roles
6. `supabase/functions/client-error-log` — sanitización de payload
7. `supabase/functions/auditoria-snapshot-daily` — agregación
8. `supabase/functions/auditoria-weekly-digest` — agregación
9. `supabase/functions/list-users` — autorización admin (regresión 403)
10. `supabase/functions/delete-user` — autorización admin

Cada uno tendrá su `*_test.ts` con casos: CORS preflight, payload inválido (400), auth faltante (401), happy path básico mockeando fetch/supabase.

### Hooks P1 restantes (extracción + test puro)

11. `useEmbarqueSubmitOrchestrator` → extraer pipeline a `src/lib/embarque/submitPipeline.ts`
12. `useEmbarquesFilters` → extraer derivaciones a `src/lib/embarque/filtros.ts`
13. `useAdminOrgKpis` → extraer agregación a `src/lib/admin/orgKpis.ts`
14. `useJsonCargoBolLookup` → extraer normalización a `src/lib/jsoncargo/bolLookup.ts`

### Utilidades P2 menores

15. `src/lib/io/zipDownload.ts` — generación zip
16. `src/generators/exportCsv.ts` — encoding/escape
17. `src/lib/sentry.ts` — guard de init

## Detalles técnicos

- Vitest para TS/TSX puro, reutilizando `_supabaseChainMock.ts` cuando aplique.
- Deno tests con `*_test.ts` junto a cada `index.ts`, mockeando `fetch` global y usando los helpers de `_shared/`.
- Para hooks orquestadores, extraer SOLO funciones puras (sin tocar comportamiento React/Query); el hook queda como wrapper delgado.
- Cero cambios en UI, RLS, schema o `src/integrations/supabase/*`.

## Verificación

- `bunx vitest run` (target: 583 → ~650+ tests pasando).
- `supabase--test_edge_functions` para los Deno suites nuevos.
- Bump `APP_VERSION` a `11.12.0`, entrada en `changelogData.ts` y chunk activo, manteniendo 10 entradas más recientes.

## Fuera de alcance

E2E Playwright (ya existen specs), tests de componentes React/UI, refactors fuera de extracciones mínimas.

## Pregunta

¿Lo hago **todo en un loop** (17 ítems, ~10-12 archivos nuevos + 4 extracciones), o lo parto en **Edge functions primero** y luego hooks/utilidades? Haz todo en un loop

&nbsp;