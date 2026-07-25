## Sidebar Etapa 3 — Medición + Colapsables + Recientes

Aplicar `instrucciones-lovable-sidebar-etapa3-2026-07-25.md` tal cual, en 3 sub-bloques. Sin favoritos (3.C descartado). No se tocan rutas, guards, builders por rol ni badges.

Analogía: es como poner un contador de pasos en las puertas de la alacena (medición), bisagras que recuerdan cuáles dejaste cerradas (colapsables) y una libretita con "lo que sacaste ayer" (recientes). La comida sigue en su lugar.

### 3.0 · Medición `nav_events` (½–1 día)
1. **Migración** — nueva tabla append-only `public.nav_events` con RLS:
   - Columnas: `id`, `organization_id` (default `current_user_org_id()`), `user_id` (default `auth.uid()`), `source` (`sidebar`|`buscador`), `item_url`, `item_title`, `section_label`, `role`, `created_at`.
   - GRANT `INSERT` a `authenticated`, `SELECT` sólo a admin/super_admin vía policy.
   - Índice `(organization_id, created_at desc)`.
   - Sin update/delete policies.
2. **Servicio** `src/services/observability/trackNavEvent.ts`:
   - `void supabase.from("nav_events").insert({...}).then(...).catch(() => {})` — fire-and-forget, jamás propaga error.
   - Guard por prefijo de `location.pathname`: no trackear `/portal`, `/login`, marketing, onboarding.
3. **Inyección**:
   - `src/components/layout/SidebarGroupBlock.tsx`: dentro de `handleNavigate`, llamar `trackNavEvent({ source: "sidebar", item_url, item_title, section_label: label })`.
   - `src/features/search/.../GlobalSearch.tsx` (`handleSelect`): `trackNavEvent({ source: "buscador", item_url: url, item_title: url })`.
4. **Tests**: vitest del service (payload correcto, error de red no propaga); test de `SidebarGroupBlock` (click dispara tracking con la sección).

### 3.A · Secciones colapsables con memoria (~1 día)
1. **Hook** `src/hooks/layout/useSidebarCollapse.ts`:
   - Estado `Record<label, boolean>` (true = colapsada).
   - Init desde `localStorage["sidebar:collapsed:v1"]` con try/catch → `{}`.
   - API: `{ isCollapsed(label), toggle(label) }`.
2. **`SidebarGroupBlock.tsx`**:
   - Envolver el grupo (modo expandido, no `collapsed` iconos) en `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`.
   - Label → botón trigger con `ChevronRight` + `rotate-90` cuando abierto, `aria-expanded`, `aria-label="Colapsar sección {label}"`.
   - **Auto-expansión**: `hasActive = items.some(isActive)`; `open = hasActive || !isCollapsed(label)` (la sección de la ruta activa siempre visible).
   - Modo `collapsed` iconos: sin trigger, comportamiento actual.
3. **`AppSidebar.tsx`**: llamar el hook UNA vez y pasar `isCollapsed`/`toggle` por props a cada `SidebarGroupBlock` (evita N suscripciones).
4. **Tests**: hook (persistencia + parseo defensivo); render del bloque con sección colapsada + ruta activa → abierta; click alterna estado.

### 3.B · Recientes en GlobalSearch (~1 día)
1. **Mapa `url → title`**: aplanar todas las constantes `SIDEBAR_*_ITEMS` de `sidebarItems.ts` en un export nuevo (p.ej. `SIDEBAR_URL_TITLE_MAP`).
2. **Hook** `src/hooks/shared/useRecentPages.ts`:
   - Montado UNA vez en `Layout.tsx`.
   - `useEffect` sobre `location.pathname`: si la URL está en el mapa, prepend, dedupe por url, cortar a 8, persistir en `localStorage["nav:recent:v1"]` con try/catch.
   - Solo URLs del mapa (nada de `/facturacion/:id` ni portal).
   - API: `{ recents: {url, title}[] }`.
3. **`GlobalSearch.tsx`**: cuando `query === ""` y `recents.length > 0`, renderizar `<CommandGroup heading="Recientes">` con icono `History` antes de los grupos existentes; al teclear, desaparece.
4. **Tests**: hook (dedupe, máx 8, sólo URLs del mapa, orden reverso); `GlobalSearch` con recientes mockeados (grupo visible con query vacío, oculto al teclear).

### Reglas globales (no negociables)
- Tracking nunca bloquea navegación (fire-and-forget + `.catch(()=>{})`).
- `nav_events` NO captura datos de negocio: sólo url/title de menú, rol y org.
- Keys de localStorage versionadas: `sidebar:collapsed:v1`, `nav:recent:v1`, parseo defensivo con default.
- Sin librerías nuevas (`collapsible.tsx` y `command.tsx` ya existen).
- No tocar builders por rol, badges ni rutas.

### Verificación
- `bun run lint --max-warnings 0`, typecheck y vitest verdes (incluidos los nuevos).
- Migración limpia; suite RLS pasa.
- Con `localStorage` vacío, el sidebar se ve idéntico a v13.318.0.
- Manual QA: 3 clicks sidebar + 1 búsqueda → 4 filas en `nav_events` con org/rol correctos; colapsar 2 secciones y F5 persiste; entrar a ruta dentro de sección colapsada la muestra abierta; ⌘K sin teclear muestra recientes en orden inverso.
- Privacidad: `select * from nav_events limit 20` no muestra folios/clientes/montos.

### Post-implementación
- Bump `APP_VERSION` → `13.319.0` (feature UX menor + tabla nueva sin breaking).
- Entrada en `CHANGELOG.md` describiendo 3.0/3.A/3.B.

### Riesgo
Bajo. Rollback = revert del PR + `drop table public.nav_events` (append-only, sin dependencias).
