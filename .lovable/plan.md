# Ola 10 — Armonización visual global (720p primero)

Objetivo: cerrar las desviaciones que quedan para que todo el ERP se vea como diseñado por un solo equipo, con prioridad en 1280×720.

## Qué ya existe (verificado)

- Tokens semánticos completos en `tailwind.config.ts`: `primary/secondary/muted/accent/destructive`, `success/warning/info`, familias `kpi.*`, `state.*`, `mode.*`, escala `aging.1-5`, radios (`--radius`), sombras (`shadow-card/raised/overlay/sticky-top`).
- Escala tipográfica parcial: `display`, `kpi`, `label`, `2xs`, `3xs`.
- Primitivas compartidas: `PageContainer`, `PageHeader`, `SectionHeading`, `KpiCard`/`KpiStrip`, `DataTable`/`VirtualDataTable`, `PaginationControls`, `SearchInput`, `FormField`, `FormDialogShell/Section/Stepper`, `DatePickerMx`, `field.tokens.ts`.
- Colores hardcodeados en clases: prácticamente eliminados (0 archivos con `bg-[#`, `text-white`, `bg-black` en `src/`).

## Lo que falta (medido)

1. `field.tokens.ts` sólo lo consumen 8 archivos: inputs, selects, textarea, datepickers y buscadores conviven con bordes/focus rings propios.
2. 150 archivos usan spacing/tamaños arbitrarios en px. La mayoría son anchos de columna legítimos (`columnWidths.ts`), pero hay ~35 con paddings/gaps/alturas fuera de la retícula 8/16/24.
3. 18 componentes de lista usan `<Table>` crudo en vez de `DataTable`/`DetailTable`: encabezados, hover, densidad y estados vacíos no coinciden (Estado de Cuenta, tablas de cotización/mercancía, P&L de embarques, catálogo SAT, conceptos de factura).
4. Rutas sin `PageContainer`: portal cliente, portal agente, marketing, legal, auth y algunos wizards. Varias sí usan `PageHeader`, así que el encabezado coincide pero el padding externo y el ritmo vertical no.
5. `style={{...}}` restante: 47 archivos, casi todos en `src/pdf/**` (legítimo en react-pdf). Fuera de PDF quedan ~6 (timelines, tarjetas de operador) que deben pasar a clases/variables CSS.
6. No existe un único contrato de tipografía documentado: falta cerrar H2/H3, títulos de tarjeta, encabezados de tabla y micro-copy como tokens con peso y line-height fijos.

## Plan por lotes

### Lote A — Contrato tipográfico y espacial
- Completar la escala en `tailwind.config.ts`: `section` (H2), `subsection` (H3), `card-title`, `table-head`, más `body`/`body-sm` con line-height fijo.
- Documentar el contrato y aplicar en `PageHeader`, `SectionHeading`, `CardTitle`, encabezados de `DataTable` y badges.
- Normalizar el padding externo: `PageContainer` como única fuente de `px`/`py` y de altura de encabezado.

### Lote B — Retícula 8/16/24
- Sustituir los ~35 archivos con paddings/gaps/alturas arbitrarias por utilidades de la escala.
- Dejar explícitamente fuera de alcance los anchos de columna en px (son medidas de tabla, no espaciado).
- Añadir regla de lint que prohíba `p-[..px]`, `gap-[..px]`, `mt-[..px]` en `src/features/**`.

### Lote C — Patrones núcleo
- Tablas: migrar los 18 componentes con `<Table>` crudo a `DataTable`/`DetailTable`, o a un `DetailTable` extendido cuando sean tablas de captura (dimensiones, conceptos editables). Encabezado, hover, densidad, vacío y paginación quedan unificados.
- Formularios: hacer que `input`, `select`, `textarea`, `date-picker-mx`, `SearchInput` y `NumericInput` consuman `field.tokens.ts` para borde, focus ring, placeholder y mensaje de validación en línea.
- KPI: barrer los dashboards restantes (Costeo, Comisiones, CRM, Auditoría, Compras) para que todo resumen use `KpiCard`/`KpiStrip` con la misma posición de icono, tendencia y variación.
- Shell: unificar estados activos y submenús del sidebar, y el ancho/alto del buscador global entre 1280 y 1920 px.

### Lote D — Micro-interacciones y verificación
- Alinear variantes de botón (primaria, secundaria, ghost, outline, destructiva) y sus estados hover/active/focus/disabled/loading con una duración de transición única.
- Sustituir los `style={{...}}` estáticos fuera de `src/pdf/**`.
- Recorrido visual en Playwright a 1920×1080 y 1280×720 de las pantallas clave de cada módulo (Inicio, Embarques, Cotizaciones, Facturación, Compras/CxP, CRM, Configuración, Portal cliente, Portal agente) con capturas antes/después.

## Notas técnicas

- Sin cambios de backend, RPC ni lógica de negocio: sólo capa de presentación.
- Se respetan los límites de Power of 10 (componentes ≤200 líneas): las tablas grandes que se migren se dividen en `*.columns.ts` + fila.
- Los lotes se ejecutan con subagentes en paralelo por módulo, con `lint`, `tsgo` y la suite de tests al cierre de cada lote.
- Al final: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
