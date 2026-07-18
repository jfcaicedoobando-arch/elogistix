## Auditoría UI/UX a 698×572 — resultado y plan

Corrí un sub-agente Playwright autenticado sobre 9 rutas (`/inicio`, `/embarques`, detalle de embarque, `/facturacion`, `/clientes`, `/reportes`, `/reportes/rentabilidad`, `/cotizaciones`, `/configuracion`) a viewport 698×572, con toggle de sidebar en `/inicio` y `/embarques`. **Overflow horizontal del `<html>`/`<main>` = 0 px en todas las rutas.** La consola solo mostró warnings benignos de React Router v7 future flags — sin errores.

### Hallazgos verificados en el código

**P1 — Botón "Buscar…" del topbar se recorta a "Busca.." entre 640 px y ~760 px**
- Evidencia: pill superior derecha en todos los screenshots muestra "Busca.." con la última letra cortada.
- Confirmado en `src/components/shared/GlobalSearch.tsx:94` — el label usa `hidden sm:inline` (aparece desde 640 px), pero a 698 px el topbar no tiene ancho suficiente para icono + "Buscar…" + iconos de derecha, y la palabra se clipa.
- Ya existe el mismo patrón resuelto para el badge `⌘K` (línea 96: `hidden md:inline-flex` — comentario cita "v13.301.64 · Auditoría 698×572").

**Regla verificada, no hallazgo — `?tab=emitidas` en Facturación**
- El sub-agente reportó que el parámetro no cambia el tab. Al leer `src/features/facturacion/routes/Facturacion.tsx:16-77`, el módulo usa `?bandeja=emitidas` (no `?tab=`); `?tab=` está reservado para redirects de URLs legacy. **No es un bug.**

**Descartado — emoji "tofu" en el saludo del dashboard**
- Búsqueda exhaustiva en `src/features/dashboard/**` no encontró ningún emoji en el string del saludo (`useDashboardController.ts:15-20` retorna solo "Buenos días" / "Buenas tardes" / "Buenas noches"). No aplico cambios.

### Cambios propuestos

**1) `src/components/shared/GlobalSearch.tsx` — subir label a `md:inline`**
- Cambio quirúrgico línea 94:
  - Antes: `<span className="hidden sm:inline">Buscar...</span>`
  - Después: `<span className="hidden md:inline">Buscar…</span>`
- Efecto: en la banda 640–767 px (donde vive 698×572) el botón queda como icono-lupa puro (34×34 px, tap target sano) y el label vuelve a aparecer a partir de `md` (768 px+), alineado al mismo breakpoint que el badge `⌘K` (evita el estado feo "icono + kbd sin label"). Aria-label ya está presente (`Abrir búsqueda global`), así que no hay regresión de accesibilidad. Aplica a las 9 rutas de golpe porque el topbar es único.
- También reemplazo `Buscar...` (tres puntos) por `Buscar…` (elipsis Unicode, un solo carácter) para consistencia con el placeholder del `CommandInput` que ya usa `…`.

**2) Verificación visual de las sombras de scroll horizontal (v13.301.67)**
- El sub-agente confirmó la lógica del código en `DataTable.tsx` + `useHorizontalScrollEdges.ts` pero **no pudo confirmar visualmente** que los degradados aparecen al scrollear la tabla — su selector de scroll cayó sobre el sheet del sidebar en vez del contenedor de la tabla, así que las capturas antes/después salieron idénticas.
- Añado un mini-script Playwright en el flujo de verificación (no un test permanente): navegar a `/embarques`, hacer scroll horizontal del `[data-scroll-container]` de la tabla, capturar `estado inicial`, `scrolleado a la derecha` y `scrolleado a la izquierda`; confirmar que el degradado derecho desaparece al llegar al final y el izquierdo aparece al despegarse del inicio. Esto queda como validación puntual — sin código de test comiteado.
- Para hacer el selector estable, agrego `data-testid="datatable-scroll"` al `<div>` con `overflow-x-auto` en `src/components/shared/DataTable.tsx` (línea ~135). No cambia estilos ni comportamiento.

**3) Bump de versión + CHANGELOG**
- `src/constants/appVersion.ts`: `13.301.67` → `13.301.68`.
- `CHANGELOG.md`: nueva entrada `[13.301.68] - 2026-07-18` describiendo (a) label del buscador global oculto hasta `md`, (b) `data-testid` estable en el contenedor de scroll de `DataTable` para futuras auditorías.

### Fuera de alcance (revisado y descartado)

- **Tabs de `/facturacion` y `/configuracion` que envuelven a 2 filas a 698 px** — es el comportamiento esperado (`flex-wrap`); todos los tabs siguen siendo tappables (>32 px). Cambiarlo a scroll horizontal introduciría regresiones en desktop.
- **Sidebar como sheet mobile a <768 px** — es el patrón `shadcn/sidebar` intencional. Cambiar el breakpoint afectaría tablet completa.
- **Anchos de tablas que exceden el viewport** — es el comportamiento diseñado (`min-w-max` + scroll horizontal con las sombras que acabamos de añadir). No hay overflow en `<main>`, solo dentro del contenedor de la tabla.

### Detalles técnicos

- Archivos tocados: 3 (`GlobalSearch.tsx`, `DataTable.tsx`, `appVersion.ts`) + `CHANGELOG.md`.
- Sin migraciones, sin cambios en RLS, sin cambios en business logic.
- Sin cambios de dependencias.
- Riesgo: nulo — el label del buscador ya está oculto en <640 px hoy; solo subo el umbral 128 px más arriba. El `data-testid` es aditivo.