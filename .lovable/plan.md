## Auditoría UI/UX a 698×572 — plan de correcciones

Analogía: 698px es una "ventana atorada" entre celular (sm) y tablet (md=768). El layout mobile ya se apagó, pero el de tablet aún no prende — ahí es donde algunas tiras horizontales cortan contenido. El resto de la app (tablas, sidebar, modales) se comporta bien: no hay overflow horizontal real en `document`; los problemas son visuales/interactivos.

### Hallazgos y fixes

**P0 — Tira de KPIs del pipeline en `/inicio` se corta a media tarjeta**
- Síntoma: la fila horizontal de contadores por etapa termina en "El…" sin scrollbar ni pista visual de que hay más.
- Fix: envolver la tira en `overflow-x-auto` con `snap-x snap-mandatory`, agregar gradiente de fade en el borde derecho y `min-w` en cada card para que no se comprima. Alternativa: `flex-wrap` en `<md` para pasar a 2 filas.
- Archivo probable: componente de "pipeline/etapas" del dashboard (`src/features/dashboard/...` o `src/features/inicio/...`). Se localizará por `rg "Confirmado" src/features` antes de editar.

**P0 — Verificar el mismo patrón en `/reportes/rentabilidad`**
- Los KPIs superiores usan la misma estructura. Aplicar mismo tratamiento si repiten el corte.

**P1 — Tabs del detalle de embarque muy apretados**
- Síntoma: `Resumen | Tracking | Documentos | Costos | Demoras y Garantías | Seguros` sin aire; frágil ante cualquier tab nueva.
- Fix: hacer la barra de tabs `overflow-x-auto` con scroll snap y `whitespace-nowrap`, en lugar de depender de shrink; opcionalmente abreviar "Demoras y Garantías" → "Demoras" debajo de `md` (con tooltip completo).
- Archivo: barra de tabs del detalle de embarque en `src/features/embarques/...`.

**P1 — Warning de React "duplicate key" (`c380b5c0-…`)**
- Aparece en `/inicio` y `/reportes/rentabilidad` (×3). No es viewport-specific pero salió en la auditoría; probablemente una lista de alertas/notificaciones interna que mergea la misma fila dos veces.
- Fix: localizar el `.map(... key={x.id})` culpable (grep en `src/features/dashboard`, hooks de `sidebar_alert_counts` / `notificaciones_internas`) y deduplicar antes de renderizar (`Array.from(new Map(rows.map(r => [r.id, r])).values())`), o corregir el join que duplica en el fetch.

**P2 — Polish**
- Barra superior: badge `⌘K` ocupa espacio fijo. Ocultarlo con `hidden md:inline-flex` para dejar más aire al buscador debajo de `md`.
- Breadcrumbs de detalle: agregar `truncate` + `max-w-*` a los segmentos para prevenir crowding con expedientes/clientes de nombre largo (aún no rompe, es red de seguridad).
- KPIs de facturación: revisar tipografía (`MXN 5.2M` y sparkline) — considerar subir 1 paso el tamaño de la cifra en el rango `sm→md`.

### Notas técnicas

- Guardrails Power of 10: los componentes tocados deben quedar ≤200 líneas; si un archivo de KPIs se pasa, extraer un `KpiPipelineStrip.tsx`.
- Tokens: usar `bg-gradient-to-r from-transparent to-background` (con tokens semánticos) para el fade-edge; nada de colores hardcodeados.
- No tocar business logic — sólo capas de presentación (Tailwind + estructura JSX).
- Bump `APP_VERSION` y entrada en `CHANGELOG.md` root al terminar.

### Fuera de alcance

- `/admin` y `/admin/organizaciones` redirigen a `/inicio` con la cuenta de auditoría (permiso), no es bug de layout — se puede validar aparte con super_admin si el usuario lo pide.
- El emoji "tofu" en la captura headless es artefacto de fuentes, no un bug real.

### Orden de implementación sugerido

1. Localizar componentes exactos (pipeline strip, tabs de embarque, lista con key duplicada).
2. P0 pipeline strip → P1 tabs → P1 dedupe keys → P2 polish.
3. Verificar visualmente a 698×572, 768×… y 1440×… con Playwright para no regresar tablet/desktop.
4. Correr `bun run ci:fast`.
