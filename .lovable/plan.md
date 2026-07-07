
# Auditoría visual — Facturación & Compras (FHD 1920×1080)

Analogía: la app hoy es como un tablero de control con muchos botones útiles, pero algunos indicadores tienen la etiqueta pegada encima del número, otros están cortados por el borde y unos cuantos repiten la palabra dos veces. La meta es dejar cada pantalla limpia, con la información importante a un golpe de vista y las acciones donde la mano las busca.

## Hallazgos por severidad

### CRÍTICOS (bugs visuales / datos incorrectos)

1. **`/compras/por-pagar` — tarjeta "Saldo total" duplica el prefijo de moneda**
   Muestra `MXN MXN 1.5K · USD USD 47.2K`. Se está concatenando el símbolo dos veces (probablemente `formatMoney(currency, amount)` recibe un valor ya formateado).
2. **`/compras/proveedores` — RFC con entidad HTML sin decodificar**
   Fila "Agunsa L&d" muestra `AL&AMP;0807074L5`. El `&` se guardó como `&amp;` y no se está decodificando al render.
3. **`/compras/facturas` — columna "APROBACIÓN" cortada por overflow horizontal**
   La tabla excede el ancho del contenedor; el header se ve como `APRO…` y las celdas se recortan. Misma clase de problema en `/compras/conciliacion` (header "CONCILIACIÓN" y badges "Sin factu…" truncados).

### ALTOS (usabilidad / workflow)

4. **`/facturacion` — 9 pestañas en una sola fila** (Embarques sin factura, Proformas listas, Por timbrar, Por enviar, Por cobrar, Vencidas, REP pendientes, Emitidas, Notas de crédito). En FHD entran, pero saturan y el usuario tarda en localizar la activa. Además la pestaña activa no destaca lo suficiente contra las inactivas.
5. **`/facturacion` — mini-charts "Últimos 6 meses" ilegibles.** Dos sparklines diminutas (Facturado / Cobrado) sin ejes ni tooltip: no aportan info accionable en el header.
6. **`/compras/por-pagar` — columna "Días" fuerza wrap `58` / `venc.`** El badge se parte en dos líneas por ancho insuficiente. También la etiqueta "PROG. PAGO" en `/compras/facturas` se parte.
7. **`/compras/por-capturar` — botón "Capturar factura" repetido en cada fila** ocupa ~180 px por renglón × 100 filas. En FHD desperdicia ancho y hace ruido visual; además la celda "Avance" pierde espacio y el texto `MXN 0.00 / MXN 6,844.80` envuelve.
8. **`/compras/facturas` — densidad de columnas alta y sin priorización.** 12 columnas visibles: Folio, Folio Prov., Proveedor, Emisión, Vencimiento, Prog. Pago, Días, Mon., Total, Pagado, Saldo, Estatus, Aprobación. Sin agrupación ni columnas colapsables el ojo se pierde. Las monedas MXN/USD conviven en misma columna "Total" sin separar visualmente.
9. **Tooltips de KPI**: los íconos `ⓘ` en las tarjetas de Facturación existen pero su contenido no está estandarizado (varias sin descripción de cómo se calcula el número → duda del usuario contable sobre qué incluye "Por cobrar" vs "Vencidas").

### MEDIOS (pulido)

10. **Encabezado de página inconsistente entre módulos.**
    - Facturación: título + subtítulo + filtro de fecha + botón primario.
    - Compras (dashboard): título + subtítulo + botón.
    - Cuentas por Pagar: título + subtítulo + 2 botones (Reporte PDF, Capturar).
    Falta un patrón único (breadcrumb + H1 + acciones a la derecha).
11. **Tarjetas KPI con jerarquía irregular.** Colores del número varían (rojo, verde, gris) sin leyenda; el usuario no sabe si el color es semántico consistente o decorativo. Además `MXN 2M` y `MXN 427K` en la misma fila mezclan abreviaturas con montos exactos.
12. **`/compras/pagos` y `/notas-credito`** parten con rango de fechas por defecto de 7 días → muestran vacío casi siempre; contable espera ver el mes en curso.
13. **`/compras/proveedores` sin totales**: 25+ proveedores sin contador ni "saldo pendiente por proveedor" en la lista; obliga a entrar uno por uno.
14. **Falta de sticky header en tablas largas** (Facturación tabs, Por capturar, Facturas). Al hacer scroll se pierden los encabezados en FHD porque la tabla supera 1080 px.
15. **Feedback de acción en modal "Registrar pago"** (ya trabajado): confirmar que el foco vuelve al botón "Registrar pago" tras cerrar y que hay toast de éxito visible sin scroll.

## Plan de mejoras (por olas)

### Ola 1 — Correcciones (sin riesgo, alto ROI)
- Corregir doble prefijo `MXN MXN` en tarjeta "Saldo total" de `/compras/por-pagar` (revisar el helper que compone `mxnLabel`).
- Decodificar entidades HTML (`&amp;`, `&lt;`) al render de RFC/Tax ID en `Proveedores` y donde se pinten strings del backend legacy.
- Ajustar anchos y overflow de las tablas de `/compras/facturas` y `/compras/conciliacion`:
  - `min-width` por columna crítica.
  - Envolver la tabla en scroll horizontal SOLO si supera el viewport (hoy corta silenciosamente).
  - Ensanchar columna "Días" para que el badge quepa en una línea.
- Homologar tooltips `ⓘ` en KPI de Facturación con texto: "Cómo se calcula" + "Qué incluye" (patrón único).

### Ola 2 — Reducir carga visual en Facturación
- Reagrupar las 9 pestañas en 2 niveles:
  - **Pipeline (izquierda):** Embarques sin factura · Proformas listas · Por timbrar · Por enviar
  - **Cartera (derecha):** Por cobrar · Vencidas · REP pendientes · Emitidas · Notas de crédito
  - Separador visual entre grupos + contador con badge de color semántico (rojo solo en Vencidas y REP pendientes).
- Sustituir los sparklines "Últimos 6 meses" del header por un solo mini-chart combinado (Facturado vs Cobrado en un card ampliado) o moverlo a una sección "Tendencia" debajo. En el header dejar solo KPIs numéricos.
- Estandarizar formato de montos: siempre 2 decimales en tarjetas grandes; abreviatura K/M solo en sparkline/tooltip.

### Ola 3 — Compras: densidad y acciones
- `/compras/por-capturar`: reemplazar botón "Capturar factura" por icono `+` en columna "Acción" (48 px) + click en la fila abre el drawer. Aprovechar el ancho recuperado para mostrar "Presupuesto" y "Facturado" en columnas separadas (hoy comparten celda con `/`).
- `/compras/facturas`: 
  - Vista de columnas configurable (checkboxes en botón "Filtros").
  - Preset default: Folio, Proveedor, Vencimiento, Días, Total, Saldo, Estatus, Acción.
  - Segunda fila colapsable con Folio Prov., Emisión, Prog. Pago, Pagado, Aprobación.
  - Separar Total MXN y Total USD en dos columnas con `tabular-nums` y alineación derecha estricta.
- Sticky header (`position: sticky; top: 0`) en las tablas de Facturación tabs, Por capturar y Facturas.

### Ola 4 — Dashboards & tooltips
- `/facturacion` y `/compras`: reglas de color semántico documentadas en el design system (verde = cobrado/al día, ámbar = por vencer 7d, rojo = vencido, gris = neutro). Aplicar consistentemente en tarjetas y badges.
- Rango de fecha por defecto en `/compras/pagos` y `/compras/notas-credito`: mes en curso (1 al día actual).
- `/compras/proveedores`: agregar columna "Saldo actual" y "# facturas vigentes" (misma fuente que Aging) + total al pie.
- Añadir tooltips en todos los badges de estado (Vigente, Vencida, Pagada, Cancelada, Sustituida) con la definición contable.

### Ola 5 — Detalles finos
- Foco/keyboard: `Enter` en filas de tablas abre el detalle; `Esc` cierra modales.
- Toast de "Pago registrado" con acción "Ver factura" para regresar sin buscar.
- Skeleton loaders en KPI cards y tablas (evitar el flash de "MXN 0.00").
- Auditar `aria-label` en botones-icono (Capturar factura, Exportar CSV, Reporte PDF).

## Detalle técnico (implementación)

- **Doble prefijo moneda:** revisar `formatCurrency`/`formatMoney` en `src/utils/financialUtils.ts` y su uso en `CxpPorPagar` → probablemente se está haciendo `${currency} ${formatMoneda(currency, value)}` cuando el helper ya inserta el prefijo.
- **Entidades HTML:** aplicar `decodeHtmlEntities` (o `he.decode`) en el mapper de `Proveedores`; idealmente sanear al INSERT/UPDATE también.
- **Tabla configurable:** extender `DataTable` con `columnVisibility` (ya usa TanStack Table v8, la API es nativa). Persistir preferencia en `browserStorage` por `tenantId + tableId`.
- **Sticky header:** clase utilitaria en `<TableHead>` del componente base (`sticky top-0 bg-background z-10 shadow-sm`).
- **Grupos de tabs Facturación:** wrapper que reciba `[{group, tabs[]}]` y renderice separador; no romper rutas actuales (`?tab=`).
- **Rangos de fecha default:** `getMonthToDateRange()` en `date-utils` (ya existe la infra en `technical/date-time-standards`).
- **Aging en Proveedores:** RPC ya existe (usado en `/compras/aging`); reusarla con `groupBy=proveedor`.
- **Tooltip estándar KPI:** crear `<KpiTooltip title description formula>` en `src/components/ui/kpi-card.tsx`.

## Fuera de alcance
- Cambios en lógica financiera / cálculos.
- Migraciones de datos.
- Rediseño de color palette (se respeta el memory Core: primario #1B2B4B, accent #2563EB, bg #F8FAFC, Inter).
- Modificar permisos (recién ajustados en v13.213.28).

## Entregables
- ~10-14 archivos tocados (utils + componentes de tabla/KPI + páginas Facturación y Compras).
- Actualización de `APP_VERSION` y `CHANGELOG.md` por ola.
- Screenshots antes/después en el CHANGELOG.

## Sugerencia de orden de ejecución
1. Ola 1 (bugs) — 1 iteración corta, alto impacto visible.
2. Ola 3 (Compras densidad) — resuelve el mayor dolor del contable.
3. Ola 2 (Facturación pestañas) — pulido percibido.
4. Ola 4 y 5 — pulido continuo.

¿Ejecuto todo en secuencia o prefieres que empecemos solo con la Ola 1 (bugs) para validar el enfoque antes de tocar layouts?
