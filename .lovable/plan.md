## Auditoría UI/UX móvil 20:9 (412×915)

Inspección visual con browser (modo demo) + auditoría de código por subagente sobre las rutas principales. Resultados, priorizados por impacto en usuarios móviles.

---

### Hallazgos críticos (rompen layout o tapan contenido)

1. **Banner de modo demo tapa el header sticky.** El banner `fixed` no empuja el `header sticky top-0` del `Layout.tsx`, así que en cada navegación el primer título/skeleton queda detrás del banner por ~50 px. Visible en `/inicio`, `/embarques`, `/cotizaciones`, `/crm`.
2. **TimelineEstadosCard del dashboard se recorta.** Tercer estado ("Arribado") se sale por la derecha sin overflow scrollable ni indicador; el ícono queda partido.
3. **Tablas con scroll horizontal pierden columnas clave.** `EmbarquesActivosTable`, `ProfitTable`, lista `/embarques`, lista `/cotizaciones`: en 412 px se ven 2-3 columnas y el resto sólo se descubre con scroll horizontal (poco descubrible). No hay vista card/list de respaldo.
4. **Paginación se desborda.** `Página 1 de 1 | 100 / pág | Anterior | Siguiente` no cabe en una sola línea en móviles 360-412 px, genera scroll horizontal global.
5. **FAB (+ azul) tapa filas/paginación.** En `/embarques`, `/cotizaciones` el FAB cubre la última fila y los controles de paginación.
6. **Toolbar de `/embarques` desaparece sin reemplazo.** `EmbarquesHeaderActions` esconde "Nuevo" y "Exportar CSV" con `hidden md:inline-flex` sin overflow-menu mobile.
7. **Tabs del CRM:** `overflow-x-auto` rompe el `ml-auto`, así que el botón de Configuración (engrane) queda fuera del viewport y se necesita scroll lateral; labels como "Cotizaciones" aparecen clippeados ("C…").

### Hallazgos importantes (degradan experiencia)

8. **Breadcrumbs muestran el slug crudo ("crm" minúscula)** en lugar del nombre del módulo. También `inicio` aparece en minúsculas.
9. **Header derecho saturado.** Search + Notificaciones + Feedback + Theme + (futuro avatar) compiten con el breadcrumb; en < 400 px conviene agrupar en un menú overflow.
10. **`/reportes/rentabilidad`, `/facturacion`, `/login`, `/` (landing form areas)** sin ninguna clase responsive. Funcionan por accidente pero no son mobile-first.
11. **Filtros sin sheet mobile en:** `/clientes`, `/crm/leads`, `/crm/oportunidades`, `/operaciones`. Sólo `/cotizaciones`, `/portal/embarques`, `/portal/facturas` tienen el patrón `*MobileFilters` correcto — usarlo como referencia.
12. **MiOperacionSection y Cargas activas por cliente:** el chart de barras horizontales y los badges (`1 En Tránsito · 1 Entregado`) se apilan ok, pero el wrap genera filas de 3 líneas; reducir tipografía / usar `truncate`.
13. **Safe-area iOS (notch / home indicator)** no respetada: el FAB (`bottom-6`) y el sticky CTA del landing pueden quedar bajo el home indicator en pantallas 20:9.

### Hallazgos menores (pulido)

14. KPI cards de `/cotizaciones` (`grid-cols-2`) tienen padding desbalanceado vs tipografía gigante (`text-4xl` para "50.0%").
15. `MobileStickyCta` del landing se solapa con el FAB cuando ambos están visibles (no aplica en app autenticada, pero conviene normalizar el sistema de "barra inferior").
16. Saludo `Buenos días 👋` ocupa 2 líneas a 412 px porque la fecha lo empuja; `PageHeader` no contempla wrap inteligente.

---

### Plan de refinamientos (orden de implementación)

**Fase 1 — Layout chrome (afecta a todas las pantallas)**
- Convertir `DemoModeBanner` a flujo normal sobre el `Layout` (o aumentar `padding-top` del `<main>` cuando esté activo) para que no tape el header sticky.
- Compactar el header en < 640 px: agrupar Feedback + Theme dentro de un menú "…", mantener visibles Search y Notificaciones. Reducir altura a 44 px en mobile.
- Breadcrumbs: mapear `inicio → Inicio`, `crm → CRM`, etc. (diccionario de labels) y truncar con tooltip.
- Añadir `env(safe-area-inset-bottom)` al FAB y a `MobileStickyCta`.

**Fase 2 — Listas y tablas (afecta a operación diaria)**
- Crear componente `ResponsiveDataTable` que en `< md` renderice tarjetas con campos prioritarios (Expediente · Cliente · Estado · ETA) y un chevron a detalle.
- Aplicarlo a Embarques, Cotizaciones, ProfitTable y `EmbarquesActivosTable`.
- Refactor de la paginación: en mobile, una sola fila compacta `‹ 1/5 ›` + selector page-size en un Sheet de "Opciones de vista".
- Reposicionar FAB: `bottom: calc(env(safe-area-inset-bottom) + 88px)` cuando hay paginación visible.

**Fase 3 — Dashboard y CRM**
- `TimelineEstadosCard`: convertir a scroll horizontal con snap + fade lateral, o reorientar vertical en `< sm`.
- CRM tabs: separar el botón de Configuración fuera del contenedor `overflow-x-auto` (grid 1fr+auto) y abreviar etiquetas con íconos a `sm`.
- `MiOperacionSection`: usar `text-xs` y `truncate` en chips secundarios.

**Fase 4 — Filtros faltantes (replicar patrón `CotizacionesMobileFilters`)**
- `ClientesMobileFilters`, `LeadsMobileFilters`, `OportunidadesMobileFilters`, `OperacionesMobileFilters`.

**Fase 5 — Páginas sin responsive**
- `/reportes/rentabilidad`: apilar KPIs en 2 cols, tabla con vista card.
- `/facturacion`: revisar `FacturaDetalle` y la lista.
- `/login` y landing forms: padding lateral mínimo 16 px, `max-w-sm` centrado, hero typography `clamp()`.

**Fase 6 — Pulido**
- PageHeader: variante mobile con título 1 línea + descripción debajo, acciones en fila scrollable.
- Tipografías de KPIs con `clamp()` para que no salten de tamaño entre 360-414 px.
- Auditoría de `min-w-0` / `truncate` en cards (Cargas activas por cliente, Profit, etc.).

---

### Detalles técnicos

- Stack: ya hay `useIsMobile` (`src/hooks/shared/useIsMobile.ts`, breakpoint 768) y patrón `*MobileFilters` con `Sheet` de shadcn. Reutilizar, no introducir librería nueva.
- Breakpoints: confirmar uso consistente de `sm: 640`, `md: 768`, `lg: 1024`. 20:9 (412 px ancho) cae en `< sm`, por lo que la mayoría de fixes van con `sm:` no `md:`.
- Safe-area: añadir utilidades `pb-safe`, `pt-safe` en `tailwind.config.ts` vía plugin o clases custom en `index.css`.
- Cada cambio implementado va con bump de `APP_VERSION` y entrada en `CHANGELOG.md` (regla del proyecto).
- Tests: agregar smoke visual en Playwright (e2e) para 412×915 sobre `/inicio`, `/embarques`, `/cotizaciones`, `/crm`.

### Fuera de alcance (este plan)
- Rediseño visual de marca / paleta.
- Nuevas funcionalidades; sólo refinamiento responsive.
- Optimización de performance / bundle (otra auditoría).

### Pregunta antes de implementar
¿Quieres que ejecute las **6 fases completas** en una sola tanda, o prefieres que arranque por **Fase 1 + Fase 2** (chrome + tablas) que es donde está el dolor más visible, y validamos antes de seguir?
