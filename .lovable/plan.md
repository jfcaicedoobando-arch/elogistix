## Diagnóstico (lo que vi en la página)

La página `/costeo/tarifas` hoy es una tabla plana muy densa. Detecto estos problemas:

1. **Cero contexto de negocio arriba**: no hay KPIs (tarifas vigentes, por vencer, pendientes de aprobar, # rutas cubiertas). El usuario tiene que adivinar el estado general.
2. **Filtros poco "vivos"**: 4 selects alineados, sin chips removibles, sin búsqueda por ruta/agente, sin botón "Limpiar". El filtro "Pendientes" llega por default y oculta el grueso de datos sin avisar — eso explica la pantalla vacía inicial.
3. **Tabla plana con repetición visual**: la misma ruta (Ningbo→Manzanillo) y el mismo agente (LONGSAIL) se repiten fila a fila. No hay agrupación, no se ve cuál es la mejor tarifa por ruta, ni quién compite con quién.
4. **Jerarquía débil**: Flete, Recargos y Total tienen el mismo peso tipográfico. El número que importa (Total comparable USD) no resalta.
5. **Badges sobrecargados**: Vigencia técnica + Aprobación se ven como dos columnas separadas; podrían combinarse en un solo "estado" con color claro (Vigente+Aprobada = verde; Vencida/Rechazada = rojo; Pendiente = ámbar).
6. **Vigencia ilegible**: `2026-06-24 → 2026-07-24` ocupa dos renglones; falta formato `dd/mmm` y un indicador "vence en N días".
7. **Acciones invisibles**: la columna "Acciones" es solo un ícono lápiz; no hay duplicar, aprobar/rechazar inline, ver desglose, ni "comparar Top 3 en esta ruta".
8. **Sin estado vacío útil**: "Sin tarifas para los filtros aplicados." sin CTA ni explicación de qué filtro está mordiendo.
9. **No hay densidad/exportar/paginación visible**, y la card de filtros no respeta el patrón estándar de otras pantallas.

## Propuesta de rediseño (UI/presentación, sin tocar lógica de datos)

### 1. Header con KPIs ejecutivos
Tira de 4 tarjetas pequeñas arriba del filtro:
- **Vigentes hoy** (count) — verde.
- **Por vencer ≤7 días** (count) — ámbar, clickeable → aplica filtro.
- **Pendientes de aprobación** (count) — azul, clickeable → filtro `borrador`.
- **Rutas cubiertas / Rutas totales** — neutro, ayuda a ver cobertura.

### 2. Barra de filtros mejorada
- Una sola card con: input de búsqueda (puerto/agente/naviera), los 4 selects actuales, botón **Limpiar filtros**, y a la derecha un toggle de densidad (compacta/cómoda) + botón **Exportar CSV**.
- Debajo, **chips activos** removibles con una X (ej. "Pendientes ×", "40' HC ×").

### 3. Vista agrupada por ruta (default) + toggle "Vista tabla"
- Por defecto, agrupamos por **Ruta + Tipo de contenedor**. Cada grupo es una card colapsable con:
  - Header: `Ningbo → Manzanillo · 40' HC` + chips (# tarifas, mejor precio USD, # agentes).
  - Cuerpo: mini-tabla compacta de las tarifas de esa ruta, ordenadas por `total_comparable`, marcando la fila #1 como "Mejor" con un badge verde sutil (mismo lenguaje del Top 3 que ya existe en `TarifaResultCard`).
- Toggle en la esquina superior derecha para volver a la **vista tabla plana** actual (la conservamos para usuarios que la prefieren).

### 4. Columnas y jerarquía visual de la tabla
- Reordenar: `Ruta · Contenedor` | `Agente / Naviera` (apilados) | `Flete` | `Recargos` | **`Total USD`** (negrita, tabular-nums, mayor tamaño) | `Vigencia` | `Estado` | `Acciones`.
- **Vigencia**: `24/jun → 24/jul` + texto muted "vence en 29 días" o badge rojo "vencida hace 6 días".
- **Estado**: un solo badge que combina Vigencia técnica + Aprobación:
  - `Vigente · Aprobada` → verde.
  - `Vigente · Pendiente` → ámbar con punto pulsante.
  - `Vencida` o `Rechazada` → rojo.
  - `Reemplazada` → gris.
- Tabular-nums en todas las columnas de dinero, alineación a la derecha.
- Mantener cebra y `hover` (ya existe en `Table`).

### 5. Acciones por fila (menú kebab)
Reemplazar el ícono solitario por un `DropdownMenu`:
- Editar
- Duplicar (manda al wizard pre-cargado)
- Comparar Top 3 de esta ruta (link a `/costeo/buscar?ruta=…&tipo=…`)
- Ver desglose de recargos (popover/sheet con lo que ya devuelve `fetchRecargosDeTarifa`)
- Si `estado_aprobacion = 'borrador'`: **Aprobar** / **Rechazar** inline.

### 6. Empty state útil
Cuando el filtro deja vacío:
- Ilustración pequeña + "No hay tarifas con el filtro **Pendientes**."
- Botón **Quitar filtro** y **Nueva(s) tarifa(s)**.

### 7. Microcopia y consistencia
- Título: dejar "Tarifas marítimas" y mover "(USD)" a un subtítulo gris ("Moneda base: USD").
- Subtítulo más corto: "Matriz CN→MX por agente, naviera, ruta y contenedor."
- Tooltip aclaratorio sobre `Total comparable` ("Flete + recargos incluidos en total, todo en USD a tipo de cambio del día").

### 8. Versionado y changelog
- Bump `appVersion` → `13.135.48`.
- Entrada en `CHANGELOG.md`:
  > **UX:** Rediseño de /costeo/tarifas con KPIs, filtros con chips, vista agrupada por ruta, badge de estado unificado y menú de acciones por fila.

## Lo que NO se toca

- RPC `get_top_tarifas`, servicios, mutaciones, RLS, types — todo igual.
- `TarifaForm`, `MultiRutaSelect`, portal de agentes — sin cambios.
- No se reemplaza la tabla por algo no-table; el toggle preserva la vista actual.

## Archivos previstos (sólo presentación)

- `src/features/costeo/routes/CosteoTarifas.tsx` — orquesta KPIs, filtros, toggle vista.
- Nuevos componentes en `src/features/costeo/components/`:
  - `TarifasKpis.tsx`
  - `TarifasFilterChips.tsx`
  - `TarifasGroupedView.tsx`
  - `TarifaEstadoBadge.tsx` (unifica vigencia + aprobación)
  - `TarifaRowActions.tsx` (dropdown)
  - `TarifasEmptyState.tsx`
- `CosteoTarifasFiltros.tsx` — añadir input búsqueda + botón limpiar + densidad + exportar.
- Tabla actual: ajustar columnas/jerarquía, sin cambiar fuente de datos.
- Todos los componentes ≤200 LOC (Power of 10).

## Validación

- `bun run lint -- --max-warnings 0`
- `bun run build`
- Captura Playwright en `/costeo/tarifas` con vista agrupada, vista tabla y empty state.

## Analogía para ti

Hoy la página es como una bodega con todas las cajas amontonadas en una sola pila enorme: están ahí, pero no sabes cuál es la mejor ni cuántas hay por destino. Lo que propongo es ponerle **etiquetas grandes en la entrada** (KPIs), **agrupar las cajas por destino en estantes** (vista agrupada por ruta), **pintar de verde la mejor de cada estante** (badge "Mejor") y **dejar un mostrador con todas las acciones** (dropdown por fila) en vez del lápiz suelto que hay hoy.

## Decisión que necesito de ti

¿Quieres que lo haga **completo** (los 8 puntos) o prefieres que arranque en una **fase 1 más chica** (KPIs + filtros con chips + badge de estado unificado + dropdown de acciones), y dejamos la vista agrupada para fase 2?
