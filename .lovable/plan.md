## Auditoría de arquitectura — Libre Carga

**Veredicto general: la base es notablemente sana.** Las reglas del proyecto (Power of 10, sin `any`, sin Supabase en UI, casts auditados, tests de arquitectura, bitácora) están **siendo respetadas** y el reporte automatizado (`reports/audit-report.md`) está en verde.

**Analogía:** la casa está bien construida y ordenada; lo que sigue son ajustes de mobiliario, no remodelación.

---

### Lo que está bien (no tocar)

- **Estructura por feature** consistente (`features/<dominio>/{components, hooks, services, domain, routes, types}`).
- **0 archivos productivos >200 líneas** (auditoría arquitectónica).
- **0 usos de `any`**, **0 `console.log`**, **0 imports relativos profundos** (`../../../`), **0 llamadas a `supabase.from()` desde `components/` o `pages/`**.
- Tests de arquitectura activos (`src/__tests__/architecture/*.test.ts`) que congelan invariantes (no-misc-feature, mutations-have-onerror, sentry-edge-wrapping, etc.).
- Casts clasificados: **0 HIGH, 0 CRITICAL** (886 MEDIUM y 466 SAFE).
- Edge functions consolidadas con `_shared/` (auth, cors, logger, sentry, response).

---

### Hallazgos ordenados por severidad

#### 1. CRÍTICO — `process-email-queue/index.ts` viola Power of 10 (373 líneas)

- **Archivo:** `supabase/functions/process-email-queue/index.ts`
- **Problema:** excede el límite de 200 líneas establecido en `mem://principles/power-of-10`. El archivo se regenera con `setup_email_infra`, lo que reinstala la versión gorda.
- **Riesgo:** cada regeneración rompe el linter de arquitectura y obliga a reaplicar parches manuales (ya documentado en `mem://technical/process-email-queue-regeneration`).
- **Fix sugerido:** extraer `authenticateRequest`, el bucle de batch y el manejo de errores a archivos hermanos (`auth.ts`, `batchLoop.ts`, `errorHandling.ts`) que ya conviven con `queueProcessor.ts`, `processItem.ts`, `messageProcessor.ts`. `index.ts` quedaría como compositor (<120 líneas).
- **Qué se puede romper:** los tests `index_test.ts` esperan que `authenticateRequest` aparezca textualmente — debe seguir exportada y nombrada igual.

#### 2. ALTA — Doble convención de "dónde vive una ruta": `src/pages/*` vs `src/features/<x>/routes/*`

- **Síntoma:** 96 archivos en `src/pages/` y 26 en `src/features/*/routes/`. Sólo 6 features migraron sus rutas hacia dentro (`auditoria`, `costeo`, `crm`, `embarques`, `facturacion`, `proformas`); el resto (cotizaciones, clientes, cxp, tesorería, profit, comisiones, portal, admin, bandejas) sigue en `src/pages/`.
- **Riesgo:** al agregar una pantalla nueva, no es obvio dónde ponerla. Aparece código orientado a un dominio dentro de `pages/` que luego termina re-exportando hacia `features/`.
- **Fix sugerido (incremental, feature por feature):**
  1. Elegir convención única — recomendación: **rutas dentro del feature** (`src/features/<x>/routes/`) porque ya es el patrón más reciente y mantiene cohesión.
  2. Mover una feature por sprint (empezar por `cotizaciones` y `clientes`, son las que más rotan).
  3. `src/routes/*Routes.tsx` (adminRoutes, crmRoutes, portalRoutes, publicRoutes) sigue siendo la fuente de verdad de URLs — sólo cambian los imports.
- **Qué se puede romper:** rutas hardcodeadas en tests E2E y `Seo` canonicals. Mitigable con grep + reemplazo.

#### 3. ALTA — `src/services/` vs `src/features/<x>/services/` mezcla criterios

- **Síntoma:** en `src/services/` viven cosas verdaderamente transversales (`auth/`, `bitacora/`, `observability/`, `search/`, `tracking/`) **junto a** dominios específicos (`pagos-factura/`, `csf/`, `notificaciones/`, `planes/`, `organization/`).
- **Riesgo:** la regla "lógica de dominio dentro del feature" se diluye.
- **Fix sugerido:**
  - Mover `pagos-factura/` → `features/facturacion/services/pagos/`
  - Mover `csf/` → `features/cliente/services/csf/`
  - Mover `planes/` → `features/admin/services/planes/`
  - Dejar en `src/services/` sólo: `auth`, `bitacora`, `observability`, `search`, `storage`, `tracking`, `notificaciones`, `organization`, `usuario`, `demoAccess`, `demoMode`, `unsubscribeService`.

#### 4. MEDIA — `src/lib/` se está volviendo el "cajón de sastre" (220 archivos, 25 subcarpetas)

- **Síntoma:** convive utilería pura (`formatters/`, `financial/`, `csv/`, `validation/`) con submódulos casi-dominio (`facturacion/`, `operaciones/`, `contacto/`, `import/`, `mappers/`).
- **Riesgo:** los aliases acaban siendo `@/lib/...` para casi todo y se pierde la pista del owner.
- **Fix sugerido (cero urgencia):**
  - `src/lib/facturacion/` → `features/facturacion/domain/`
  - `src/lib/operaciones/` → `features/embarques/domain/`
  - `src/lib/contacto/` → `features/cliente/domain/`
  - Dejar en `src/lib/` sólo utilería genuinamente cross-feature (formatters, financial, browserStorage, errors, query, supabase, ui, validation, observability).

#### 5. MEDIA — 886 casts MEDIUM acumulados

- Reporte: `reports/audit-report.md`.
- No bloquean nada (no hay HIGH/CRITICAL), pero son la principal fuente futura de bugs de tipos.
- **Fix sugerido:** asignar 1h/sprint para bajar el contador (objetivo: -50/sprint). Cada bajada que sea legítima debe usar el marcador `// SAFE-CAST:` documentado en `mem://principles/safe-cast`.

#### 6. BAJA — `src/components/ui/sidebar.tsx` (637 líneas)

- Es boilerplate de shadcn-ui — aceptable y esperado.
- **Acción:** marcarlo explícitamente como excluido en la auditoría (ya excluido de facto porque vive bajo `ui/`).

#### 7. BAJA — Folders locales dentro de pages: `src/pages/marketing/sections/`, `src/pages/auth/components/`

- Inconsistente con la regla "componentes específicos viven junto a la página". Si migramos rutas hacia features (hallazgo 2), este punto se resuelve solo. Si no, mover esos `sections/` y `components/` a `features/<x>/components/`.

#### 8. BAJA — Duplicación nominal de `index.ts` (94) y `queryKeys.ts` (18)

- Es barril/convención sana, no un bug.
- **Vigilar** con `knip` (ya configurado) para detectar exports muertos en los barriles. Sugerencia: agregar `bun x knip --reporter compact` a CI semanal.

#### 9. INFO — Edge functions de email: oportunidad de consolidación futura

- Existen: `send-transactional-email`, `enviar-cotizacion-email`, `process-email-queue`, `preview-transactional-email`, `handle-email-suppression`, `handle-email-unsubscribe`.
- Comparten `_shared/email/` ya. **No urge consolidar**, pero a futuro un patrón tipo `user-management` (1 función con `action`) reduciría superficie.

---

### Plan ordenado (de más crítico a opcional)

```text
Paso 1  [CRÍTICO]   Refactor process-email-queue/index.ts a <120 líneas
                    (con guardrail en el script de regeneración para no
                    perder los parches).
Paso 2  [ALTA]      Migrar rutas de cotizaciones y clientes desde
                    src/pages/ a src/features/<x>/routes/ — feature piloto.
Paso 3  [ALTA]      Mover pagos-factura, csf y planes desde src/services/
                    al feature correspondiente.
Paso 4  [MEDIA]     Adelgazar src/lib/: mover facturacion/, operaciones/,
                    contacto/ a domain/ del feature dueño.
Paso 5  [MEDIA]     Continuar migración de rutas (cxp, tesorería, profit,
                    comisiones, portal, admin) feature por feature.
Paso 6  [MEDIA]     Iniciar reducción incremental de casts MEDIUM
                    (-50 por sprint, marcador SAFE-CAST cuando aplique).
Paso 7  [BAJA]      Mover sections/ de marketing y components/ de auth
                    al feature correspondiente.
Paso 8  [BAJA]      Agregar `bun x knip` al CI semanal para detectar
                    exports muertos en barriles.
Paso 9  [OPCIONAL]  Estudiar consolidación de edge functions de email
                    con patrón `action:` (similar a user-management).
```

Cada paso es independiente y se puede entregar sin bloquear los demás. Recomiendo arrancar por el **Paso 1** porque ya está rompiendo la regla de 200 líneas cada vez que se regenera la edge function.

¿Apruebo arranque por el Paso 1, o prefieres priorizar el Paso 2 (migración de rutas) que es más visible para el equipo?
