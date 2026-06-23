## Auditoría Sentry — hallazgos restantes tras 13.114.17

Los sub-agentes (frontend + edge functions) confirman que la base está sólida, pero detectan **7 gaps reales**. Propongo cerrarlos en una sola tanda como `13.114.18` (bajo riesgo, sin cambios de semántica).

### Hallazgos a corregir

| # | Sev | Área | Problema | Fix |
|---|---|---|---|---|
| 1 | ALTA | Guardrail edge | `facturapi-emitir-rep` y `facturapi-cancelar-rep` (REP fiscal) no están en `CRITICAL` del test `sentry-edge-wrapping.test.ts` | Añadirlas al array |
| 2 | MEDIA | Sampling | `/cartera` cae al 10% default (debería 50% como CxC/CxP) | Ampliar regex finanzas |
| 3 | MEDIA | Sampling | `/proformas` (documentos financieros) cae al 10% default | Subir a 50% |
| 4 | MEDIA | React Query | `queryKey[0]` y `mutationKey` se envían en `extra` → no filtrable en Sentry | Moverlos a `tags` en `queryClient.ts` |
| 5 | BAJA | Sampling | `/portal/*` (cliente final, alto impacto NPS) en 10% default | Grupo propio a 50% |
| 6 | BAJA | Sampling | `/legal/*` y `/recursos/*` consumen cuota innecesaria al 10% | Añadir a regex de exclusión (0%) |
| 7 | INFO | Edge shared | `wrapEdgeHandler` no escruta `password`/`token` en `extra` | Lista negra de keys sensibles en `_shared/sentry.ts` |

### Diferida (requiere decisión separada)

- **`user-management` patrón manual filtra por `status >= 500`** → errores 4xx críticos invisibles. Migrar a `wrapEdgeHandler` cambia semántica de respuesta de error; lo dejo fuera de este lote salvo que pidas migrarlo.
- **CORS `*` en `sentry-tunnel`** → restringir a `librecarga.com` rompería reportes desde previews `lovable.app`. Recomiendo dejarlo abierto (ya hay rate-limit + allowed hosts).

### Archivos a tocar

1. `src/__tests__/architecture/sentry-edge-wrapping.test.ts` — añadir 2 funciones REP
2. `src/lib/observability/sentry/helpers.ts` — `sampleByRoute`: `/portal/*` (0.5), `/cartera` y `/proformas` (0.5), exclusión `/legal|/recursos` (0)
3. `src/lib/query/queryClient.ts` — `queryKey[0]`/`mutationKey` → `tags`
4. `supabase/functions/_shared/sentry.ts` — scrub de keys `password|token|secret|apikey|authorization` en `extra` antes de enviar
5. `src/constants/appVersion.ts` → `13.114.18`
6. `CHANGELOG.md` → entrada `[13.114.18]`

### Validación

- `vitest run src/__tests__/architecture/sentry-*` debe pasar
- `deno test supabase/functions/sentry-tunnel/` sin cambios
- Smoke manual: navegar `/cartera`, `/proformas`, `/portal/dashboard` y verificar en DevTools que `sampleByRoute` devuelve los valores esperados

¿Lo ejecuto tal cual o quieres ajustar el alcance (p. ej. incluir migración de `user-management` a `wrapEdgeHandler`)?