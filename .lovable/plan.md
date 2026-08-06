# Armonización visual global del ERP (720p first)

## Lo que ya está resuelto (verificado en el código)

Antes de proponer trabajo, revisé el estado real:

- **Tokens de color: ya cumplen.** Fuera de la landing pública y un test, hay **0 usos** de colores literales de Tailwind (`text-green-600`, `bg-slate-100`, etc.) y **0 hexes** en componentes de app (solo en el generador de PDF, donde es obligatorio). `tailwind.config.ts` ya expone paletas semánticas: `primary`, `secondary`, `success`, `warning`, `info`, `destructive`, `kpi.*`, `state.*`, `mode.*`, `aging.1-5`, radios y sombras (`shadow-card/raised/overlay/sticky-top`).
- **Escala tipográfica: existe** (`display`, `kpi`, `label`, `2xs`, `3xs`, `text-overline`) y hay un componente canónico `SectionHeading`.
- **Contenedor de página: existe** `PageContainer` (padding `p-4 sm:p-6`, ancho `default`/`wide`, ritmo `space-y-6`) y lo usan 76 archivos.
- **Tablas: existe** `DataTable`/`ResponsiveDataTable` con densidad, striping, hover, skeleton por densidad, paginación y estado vacío.

Es decir: el sistema de diseño está construido. Lo que falta es **adopción uniforme**. Ahí es donde se rompe la sensación de "un solo equipo".

## Los huecos reales que encontré

1. **Encabezados de sección desalineados** — `SectionHeading` solo se usa en 15 archivos, pero hay **115 archivos** con escalas de encabezado escritas a mano (`text-sm font-bold`, `text-lg font-semibold`, `text-base font-bold`…). Es la mayor fuente de incoherencia visual.
2. **Tarjetas KPI ad-hoc** — pantallas que dibujan su propia métrica con `Card` + `text-2xl font-bold` en vez de `KpiCard`: Dashboard de Admin, Dashboard de CRM, Cliente 360, Cierre de facturación, Tab de Seguros, Auditoría ejecutiva, Detalle de factura del portal, Panel de conciliación de tesorería.
3. **Tablas crudas** — 18 componentes usan `@/components/ui/table` directo (conceptos de factura, estado de cuenta, tablas del wizard de cotización, P&L, catálogo SAT, portal). No comparten header, hover, densidad ni footer de totales.
4. **Páginas sin `PageContainer`** (padding y ancho distintos al resto): Nueva/Editar Cotización, Nuevo/Editar Embarque, CRM (layout y detalle de oportunidad), portal de cliente y portal de agente.
5. **Pixeles arbitrarios en componentes compartidos**: `DetalleActionBar`, `PortalFiltersBar`, `PaginationControls`, `KpiCardBody`, `SidebarGroupBlock`, `LoadingState`. Hay que separar los legítimos (anchos de sidebar, altos de virtualización) de los que deben ir a la grilla 8/16/24.

## Plan de ejecución (4 olas, verificables)

### Ola 1 — Jerarquía tipográfica y espacial
- Cerrar la escala en un solo lugar: H1 = `PageHeader`/`DetailHeader`, H2/H3 = `SectionHeading` (`section` / `overline`), título de tarjeta = `CardTitle`, header de tabla y micro-copy = `text-label` / `text-2xs`.
- Migrar los 115 archivos con encabezados a mano a `SectionHeading`, por módulo (Compras/CxP, Facturación/CXC, Embarques, Cotización, Tesorería, CRM, Configuración, Auditoría, Portales).
- Meter las páginas faltantes dentro de `PageContainer` para que padding externo, ancho máximo y ritmo vertical sean idénticos.
- Normalizar espaciados a 8/16/24 (`gap-2/4/6`, `space-y-4/6`) y quitar los px arbitrarios no justificados de los componentes compartidos.

### Ola 2 — Patrones de datos
- **KPIs**: migrar las 8 pantallas con tarjetas ad-hoc a `KpiCard`/`KpiStrip` (valor, tendencia, % de cambio, icono y tono en la misma posición siempre), respetando el formato compacto que ya evita truncado en 720p.
- **Tablas**: crear un envoltorio compartido para tablas de detalle/anidadas (conceptos, totales, P&L) con header, hover, densidad y footer de totales tomados de los tokens de `DataTable`; migrar los 18 componentes.
- Unificar estado vacío (`EmptyState`), skeleton por densidad y controles de paginación en todos los listados.

### Ola 3 — Formularios, shell y variantes de botón
- Auditar `input`, `textarea`, `select`, pickers de fecha y `SearchInput` para que compartan borde, hover, anillo de foco y placeholder exactos; hoy los inputs usan `ring-ring/40 offset-0` y el botón `ring-ring offset-2` — se fija una sola regla de foco.
- Unificar el patrón de mensaje de validación inline (`FormField`) y el shell de modales (`FormDialogShell`) en los formularios que aún los evitan.
- Sidebar: revisar item activo, expansión de submenú y alineación del buscador global en 1280×720, 1366×768 y 1440×900.
- Botones: verificar que cada pantalla tenga **un solo** CTA primario y que Secondary/Ghost/Outline/Destructive se usen con el mismo criterio.

### Ola 4 — Micro-interacciones y verificación visual
- Unificar transiciones (`transition-colors duration-150`), estados hover/active/focus/disabled y esqueletos de carga.
- Auditoría visual con Playwright a **1280×720** en las rutas principales de cada módulo, con capturas antes/después y comparación de altura de header, padding y alineación de KPIs.

## Notas técnicas

- Nada de cambios de lógica de negocio: solo capa de presentación y componentes compartidos.
- Se respetan los límites de arquitectura del proyecto (componentes ≤200 líneas, sin `any`), así que los migradores grandes se dividen en subarchivos `_sections` cuando haga falta.
- La landing pública, páginas legales y guías SEO quedan **fuera** de la armonización interna (tienen su propio lenguaje de marketing), salvo tokens de color.
- Cada ola cierra con `CHANGELOG.md` actualizado y bump de `APP_VERSION`.
- Trabajo paralelizado con subagentes por módulo para acelerar la migración.
