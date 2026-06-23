## Auditoría Sentry — Resumen ejecutivo

**Estado general:** la implementación está por encima del estándar (túnel, sampling dinámico, PII scrub, release inyectado, tracePropagationTargets correcto, integración con React Query). Lo que falta es **cerrar gaps de cobertura** en módulos nuevos (`/compras`, `/costeo`, `/crm`), **migrar 8 edge functions del patrón legacy al wrapper canónico**, y **endurecer el sentry-tunnel**.

### Analogía

Tenemos cámaras de seguridad de buena marca instaladas — pero algunas zonas nuevas del almacén (compras, costeo) tienen las cámaras grabando a baja resolución, otras 8 cámaras viejas todavía graban "en VHS" en vez del sistema digital nuevo, y la puerta del cuarto de monitoreo (sentry-tunnel) no tiene candado contra alguien que quiera saturar la grabación.

---

## Hallazgos consolidados (3 sub-agentes)


| #   | Severidad  | Área                       | Hallazgo                                                                                                                                                                                                                                                                    |
| --- | ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **HIGH**   | Edge — `sentry-tunnel`     | Sin rate-limit ni protección contra abuso; un atacante con un DSN permitido puede agotar la cuota Sentry.                                                                                                                                                                   |
| 2   | **HIGH**   | Frontend — `sampleByRoute` | Rutas nuevas (`/compras`, `/costeo`, `/crm`) caen en el default 10%; perdemos trazas de flujos críticos.                                                                                                                                                                    |
| 3   | **MED**    | Edge — 8 functions         | `user-management`, `parse-csf`, `cxc-recordatorios`, `auditoria-snapshot-daily`, `auditoria-explicar-hallazgo`, `tracking-public`, `demo-access`, `client-error-log` siguen con el patrón legacy (manual try/catch). Riesgo: si alguien borra el catch, los 500 se pierden. |
| 4   | **MED**    | Tests                      | `sentry-edge-wrapping.test.ts` no incluye las 8 críticas; no detecta regresión.                                                                                                                                                                                             |
| 5   | **MED**    | Frontend — ErrorBoundary   | Sólo hay uno raíz en `App.tsx`; un crash en una pestaña tumba toda la UI. Faltan boundaries por feature.                                                                                                                                                                    |
| 6   | **MED**    | Frontend — logger          | `logger.info`/`warn` no llaman a `Sentry.addBreadcrumb`; los errores en prod llegan sin historial de pasos previos.                                                                                                                                                         |
| 7   | **MED**    | PII                        | `piiScrub.ts` no cubre teléfonos (la app maneja contactos de clientes/proveedores).                                                                                                                                                                                         |
| 8   | **LOW**    | Release                    | Falta `dist` (hash de build) para distinguir hotfixes con misma versión semver.                                                                                                                                                                                             |
| 9   | **LOW**    | Contexto                   | Sin tag `is_pwa` (display-mode standalone).                                                                                                                                                                                                                                 |
| 10  | **LOW**    | Secrets                    | `DEFAULT_DSN` hardcodeado como fallback — riesgo de mandar errores a bucket equivocado si cambia el proyecto.                                                                                                                                                               |
| 11  | **VERIFY** | SDK version                | `@sentry/react ^10.53.1` — un sub-agente lo marcó como anomalía, pero **v10 existe oficialmente desde 2025**. Verificar con cambios recientes antes de tocar.                                                                                                               |


---

## Plan de remediación (3 fases)

### Fase 1 — Seguridad y cobertura crítica (1 tanda)

1. **Rate-limit en `sentry-tunnel**`: usar la tabla `ratelimit_buckets` existente para limitar a ~60 req/min por IP. Devolver 429 al exceder.
2. **Actualizar `sampleByRoute**` en `src/lib/observability/sentry/helpers.ts`: añadir `/compras`, `/costeo`, `/crm/oportunidades/*`, `/crm/leads/*` al bucket de 1.0 (flujos críticos) y `/crm` listado al 0.5.
3. **Sincronizar test `sentry-edge-wrapping.test.ts**`: agregar las 8 funciones legacy a la lista `CRITICAL` para que falle el build si no migran.

### Fase 2 — Migración de edges legacy a `wrapEdgeHandler` (1 tanda por edge o batch)

Migrar las 8 funciones al patrón canónico documentado en `_shared/sentry.ts`:

- CRÍTICAS: `user-management`, `parse-csf`, `cxc-recordatorios`, `auditoria-snapshot-daily`, `auditoria-explicar-hallazgo`
- MEDIA: `tracking-public`, `demo-access`
- BAJA: `client-error-log`

Cada migración: envolver el `Deno.serve` con `wrapEdgeHandler(handler, { fn: "<name>" })`, eliminar try/catch redundantes, preservar lógica de negocio. Agregar test por edge si hace falta.

### Fase 3 — Mejoras de calidad (1 tanda)

4. **Boundaries por feature**: agregar `<ErrorBoundary>` en `src/routes.tsx` por grupo de rutas (Embarques, CxC, CxP, Cotizaciones, CRM, Compras, Costeo, Auditoría, Admin).
5. **Logger → breadcrumbs**: en `src/lib/observability/logger.ts`, mapear `info`/`warn` a `Sentry.addBreadcrumb` (incluso en prod) con sampling para no inundar.
6. **PII teléfonos**: regex para formatos MX (`+52 1 55 1234 5678`, `5512345678`, `(55) 1234-5678`) en `piiScrub.ts` + test.
7. `**dist` en `Sentry.init**`: inyectar `import.meta.env.VITE_BUILD_HASH` o timestamp del build.
8. **Tag `is_pwa**`: `setTag("is_pwa", matchMedia("(display-mode: standalone)").matches)` en `core.ts`.
9. **Eliminar `DEFAULT_DSN` hardcodeado**: requerir `VITE_SENTRY_DSN`, log warn si falta.
10. **Verificar SDK**: comprobar release notes de `@sentry/react` v10 — si todo OK, documentar; si hay incompatibilidades, fijar versión.

### Entregables comunes a cada fase

- Bump `APP_VERSION` y entrada en `CHANGELOG.md` por cada fase (Fase 1 → `13.114.17`, Fase 2 → `13.114.18`, Fase 3 → `13.114.19`).
- Tests existentes (`sentry-edge-wrapping`, `sentry-imports-guardrail`) deben seguir verdes.

---

## Detalles técnicos

- `**sampleByRoute` (helpers.ts:101)**: agregar regex `/^\/(compras|costeo)/i → 1.0`, `/^\/crm\/(leads|oportunidades)\//i → 1.0`, `/^\/crm/i → 0.5`.
- `**wrapEdgeHandler**` ya existe en `supabase/functions/_shared/sentry.ts` con `flush(2000)` antes de retornar; migración es mecánica.
- **Rate-limit tunnel**: usar el patrón de `ratelimit_buckets` que ya tiene `cxc-recordatorios` o helpers en `_shared/`.
- **PII teléfonos**: la regex debe escapar contextos legítimos (folios, IDs numéricos largos); validar con corpus de mensajes Sentry pasados si está disponible.

---

## Pregunta antes de implementar

¿Ejecuto las **3 fases en orden** (con bumps de versión separados) o prefieres que arranquemos sólo por **Fase 1 (alto impacto, bajo riesgo)** y revisemos antes de seguir? Ejecuta las 3 fases completas y después bump 