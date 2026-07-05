## Objetivo

Dejar toda la app operativa+financiera perfectamente usable en **iPad vertical (768×1024)**: sin scroll horizontal en tablas, filtros compactos y legibles, KPIs en grid, modales con footer sticky, sidebar colapsado por defecto, y sin overlaps/textos truncados.

## Alcance (15 rutas)

Núcleo operativo: `/inicio`, `/operaciones`, `/embarques`, `/cotizaciones`, `/proformas`, `/facturacion`.
Financiero: `/compras`, `/cxp`, `/cartera`, `/tesoreria`, `/profit/dashboard`, `/profit/proyeccion`.
Catálogos: `/clientes`, `/proveedores`.
Portal cliente/agente y admin **fuera de alcance**.

Para cada ruta se audita **listado + un detalle representativo + modales/wizards clave** (nuevo cliente, nueva cotización, nueva factura manual, filtros drawer, etc.).

## Método

1. **Captura automatizada con Playwright** a 768×1024 vía script existente `scripts/visual-audit/capture.py` (extender para escenarios detalle+modal). Login con `AUDIT_EMAIL=hector@lopezbenavides.com`.
2. Por cada ruta se guardan 2–4 screenshots (listado, listado con filtros abiertos, detalle, modal). Se recolectan errores de consola.
3. Se revisa **cada captura** contra la checklist tableta (ver abajo) y se anota hallazgo con severidad P0/P1/P2 en `.lovable/plan-tablet-audit.md`.
4. Se ejecuta el smoke E2E (`e2e/specs/*.spec.ts`) sólo como red de seguridad post-fix para verificar que no rompimos flujos.

### Checklist tableta (criterios objetivos)

- Sin scroll horizontal en tablas de listado principal (permitido en sub-tablas densas si hay sticky y >8 columnas).
- Headers de página: título + descripción caben en 2 renglones máx.
- Barras de filtros: 1–2 renglones, selects con labels visibles (no truncados a "Todos…").
- KPI/dashboards: usan `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4/6` (no stack vertical con whitespace).
- Modales tipo formulario: `FormDialogShell` con footer sticky y contenido scrolleable.
- Sidebar colapsado por defecto en `<lg` (ya existe en `Layout.tsx`), sin superponerse al contenido.
- FAB visible sin tapar última fila (padding `pb-24 md:pb-6`).
- Textos largos con `line-clamp` + `title` tooltip; encabezados críticos con `whitespace-nowrap`.
- Sin `text-[10px]`, sin colores hardcoded, tokens semánticos respetados.

## Ejecución del reporte

Fase 1 — **Reporte**:
- Correr script Playwright ampliado y generar carpeta `/tmp/tablet-audit/` con capturas + `REPORT.md`.
- Consolidar hallazgos por ruta con severidad y archivo/componente responsable.

Fase 2 — **Fixes P0/P1/P2** en varios turnos si es necesario, agrupados por patrón:

- **Grupo A · Tablas con overflow** (embarques, cotizaciones, compras, cxp, tesorería, clientes, proveedores): reducir padding celda en `md`, `min-w/max-w` en columnas largas, `whitespace-nowrap` en encabezados numéricos, `line-clamp-2 + title` en nombres de cliente/descripción, ocultar columnas secundarias `hidden xl:table-cell` cuando ayude.
- **Grupo B · Barras de filtros** (usar `UnifiedFiltersBar` donde no esté, `flex flex-wrap gap-2` consistente, drawer `MobileFiltersSheet` reutilizado para `<lg` cuando haya >3 filtros).
- **Grupo C · Dashboards / KPIs** (`/inicio`, `/facturacion`, `/profit/*`, `/tesoreria`): pasar cards apiladas a `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6`, quitar `min-w-[120px]`, alinear tipografía.
- **Grupo D · Headers de página**: normalizar via `PageHeader` con `description` de 1 línea (`line-clamp-1` en `md`), acciones agrupadas y con overflow menú si >2.
- **Grupo E · Modales / Wizards**: verificar `FormDialogShell` con `max-h-[85vh]`, footer sticky y stepper compacto en tableta.
- **Grupo F · Fixes puntuales** que salgan del reporte (breadcrumb labels, chips que rompen tabs, etc.).

## Fuera de alcance

- No se toca lógica de datos, hooks, queries, RLS, ni cálculos.
- No se rediseñan páginas; sólo ajustes de responsive/tokens.
- No se agregan librerías.
- Portal cliente, portal agente y `/admin/*` no entran (se auditan en un tercer turno si lo pides).

## Detalles técnicos

- Script base: `scripts/visual-audit/capture.py` — se le agrega un modo `--scenarios` para navegar a `[listado, listado?filtros=open, detalle, modal-nuevo]` por ruta usando selectores estables (`getByRole`).
- Salida: `/tmp/tablet-audit/<slug>/*.png` + `REPORT.md` + `report.json`.
- Verificación post-fix:
  - Re-captura mismas rutas y comparación side-by-side.
  - `bun run lint` limpio.
  - `bunx vitest run` (tests existentes) verde.
  - Smoke E2E local sólo si algún fix toca layouts que los specs recorren.
- Versionado: cada tanda de fixes bumpea patch en `src/constants/appVersion.ts` y agrega entrada en `CHANGELOG.md` bajo `## [X.Y.Z] - YYYY-MM-DD`.

## Entregables por turno

1. **Turno 1 (build)**: extender script, correr captura, publicar `REPORT.md` con hallazgos priorizados.
2. **Turnos 2–3**: aplicar fixes por grupos A–F, re-capturar y anexar diff visual al reporte, bump de versión.
3. **Turno final**: resumen ejecutivo + estado final de checklist tableta por ruta.

## ASCII de la vista tableta objetivo

```text
768px
┌───┬─────────────────────────────────────────┐
│ ▤ │ header 44px  ⌘K  🔔  ☾                  │
│   ├─────────────────────────────────────────┤
│ s │ PageHeader (title + desc 1 línea)       │
│ i │ [tabs strip si aplica]                  │
│ d │ [filtros flex-wrap · Exportar]          │
│ e │ ┌─────────────────────────────────────┐ │
│ b │ │ tabla sin scroll horizontal         │ │
│ a │ │ · Cliente line-clamp-2              │ │
│ r │ │ · números whitespace-nowrap         │ │
│   │ └─────────────────────────────────────┘ │
└───┴─────────────────────────────────────────┘
```
