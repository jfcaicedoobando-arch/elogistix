
# Plan — CRM: menos bloatware, menos fricción

Objetivo: que un vendedor abra el CRM y en 1 clic sepa qué hacer y lo haga, sin saltar entre pestañas, modales y vistas que repiten lo mismo.

## Diagnóstico (qué sobra hoy)

**Duplicaciones detectadas:**
1. **Botón "Nuevo X" repetido 3 veces** — `QuickAddMenu` global (header CRM) + botón en cada página (`Nuevo lead`, `Nueva oportunidad`) + `FloatingActionButton`. Triple ruido.
2. **Vencidas aparece en 3 lugares** — Badge en tab Actividades, `VencidasAlert` en dashboard y como regla #5 dentro de `NextBestActionsCard`. Solapamiento total.
3. **Títulos redundantes** — Sidebar "CRM" + tab "Inicio" + `PageHeader "Inicio"` dentro de `CrmDashboard`. Ocupa 3 franjas verticales antes del contenido útil.
4. **Filtros siempre visibles en Oportunidades** — `SearchInput` + `OportunidadesFiltersBar` (5 filtros) ocupando ~160px arriba aunque el usuario sólo quiera ver el Kanban.
5. **Analítica con 4 sub-tabs** — Forecast y Embudo cuentan lo mismo desde dos ángulos; Pérdidas es un solo widget que cabe junto al embudo.
6. **Configuración con 3 sub-tabs** — pipeline + motivos + plantillas son listas cortas que caben acordeones en una sola página.
7. **Dashboard sobrecargado** — `NBA` + `VencidasAlert` + `ActividadesHoyCard` + 4 cards grandes en grid + 4 KPIs = 11 bloques visibles al cargar.

**Fricción detectada:**
- Cualquier acción rápida (completar actividad, mover etapa, registrar llamada, cambiar responsable) abre **diálogo modal**. No hay edición inline.
- Para marcar "lead contactado" hay que entrar al detalle.
- Convertir lead → diálogo separado de cambiar etapa.
- Importar CSV ocupa botón fijo en la barra aunque se use 1 vez al mes.

---

## Cambios propuestos

### 1. Header CRM colapsado a una franja
- Eliminar `<h1>CRM</h1>` y descripción de `CrmLayout`. La sidebar ya dice "CRM".
- Tabs + `QuickAddMenu` en una sola franja (`h-12`). Engranaje a la derecha.
- Eliminar `PageHeader` de `CrmDashboard`, `Leads`, `Oportunidades`, `Actividades`, `Analitica` (el tab activo + el contexto ya son suficientes). Mantener sólo un subtítulo dinámico ligero con el contador (ej. `"127 leads · 12 nuevos esta semana"`) alineado a la derecha.

### 2. Un único punto de creación
- **Quitar** los botones "Nuevo lead" / "Nueva oportunidad" de `Leads.tsx` y `Oportunidades.tsx`.
- **Quitar** todos los `FloatingActionButton` del CRM.
- Conservar **solo** `QuickAddMenu` del header (lo más visible y siempre disponible).
- Agregar atajo de teclado `N` para abrir el QuickAddMenu y `L/O/A` para crear lead/oportunidad/actividad directamente.

### 3. Vencidas: un solo lugar
- **Eliminar** `VencidasAlert` del dashboard (la regla "Actividad vencida" de NBA ya lo cubre con prioridad 60).
- Subir la regla "vencidas" al score 110 en `nextBestActions.ts` para que aparezca primero cuando exista.
- Mantener el badge rojo en el tab Actividades como único indicador secundario.

### 4. Dashboard re-priorizado (de 11 bloques a 6)
Nuevo orden:
1. `NextBestActionsCard` (top 5 cosas a hacer hoy) — única fila destacada.
2. Grid 2 cols: `ActividadesHoyCard` · `CerrandoSemanaCard`.
3. Grid 2 cols: `CotizacionesSinRespuestaCard` · `LeadsSinContactarCard`.
4. **Quitar** `TopDealsCard` del dashboard (vive ya en Oportunidades ordenadas por monto).
5. KPIs: pasar de 4 cards grandes a una sola fila compacta tipo `stat strip` (h-14) con los 4 números pequeños.

### 5. Oportunidades — filtros colapsables
- Mostrar por defecto sólo `SearchInput` + chip "Filtros (0)".
- `OportunidadesFiltersBar` se expande on-demand en un `Collapsible`. El badge muestra cuántos filtros activos.
- Persistir el estado expandido/colapsado en `useListPageState`.
- Mover "Importar CSV" en Leads a un item del menú contextual del header (engranaje o `…`) — ya no botón principal.

### 6. Analítica — de 4 sub-tabs a 1 vista
- Página única scrollable con secciones: **Pipeline & Forecast** (cards de totales + tabla por mes/vendedor), **Embudo + Pérdidas** lado a lado, **Vendedores** (sólo si `canEdit`).
- Eliminar `Tabs` y `?tab=` query param (mantener redirect para no romper links viejos).

### 7. Configuración — una sola página con acordeones
- Sustituir los 3 `TabsTrigger` por 3 `Accordion` items (Pipeline / Motivos / Plantillas). El primero abierto por default.
- Quita un nivel de navegación.

### 8. Acciones inline (reducción de modales)
- **Leads (tabla):** columna "Estado" editable inline con `Select` (Nuevo → Contactado → Calificado → Convertido). Sin abrir detalle ni modal.
- **Actividades (tabla):** checkbox a la izquierda para `marcar completada` con optimistic update + toast con "deshacer".
- **Oportunidades (kanban):** quick edit de monto con doble-clic en la card (input inline). Ya soporta DnD de etapa.

### 9. Limpieza de componentes
- `VencidasAlert.tsx` → eliminar.
- `TopDealsCard` y `LeadsSinContactarCard` se mantienen pero pasan a un patrón `CompactListCard` compartido (menos estilos custom).
- `QuickAddMenu` añade item "Importar leads CSV" para no perder esa función.

---

## Detalles técnicos

- **Atajos de teclado**: nuevo hook `useCrmHotkeys()` montado en `CrmLayout` con `useEffect` + listener `keydown` + cleanup. Ignora cuando hay input/textarea enfocado.
- **Edición inline de estado en Leads**: nueva mutación `useUpdateLeadEstado` (PATCH sólo `estado`) + `Select` celda dentro de `leadsColumns.tsx`; usar `e.stopPropagation()` en `onClick` para no disparar `onRowClick`.
- **Edición inline monto en Kanban**: handler `onMontoChange` en `OportunidadKanban`, reutiliza `useActualizarOportunidad`.
- **Filtros colapsables**: usar `Collapsible` de shadcn; estado `filtersOpen` persistido vía `useListPageState({ extras: { filtersOpen: false } })`.
- **NBA prioridad**: cambiar `OVERDUE_SCORE` a 110 en `src/lib/crm/nextBestActions.ts` y actualizar test correspondiente.
- **Quitar `VencidasAlert`** del bundle: eliminar archivo y import. El hook `useActividadesVencidas` queda en uso por el badge del tab.
- **PageHeader**: reemplazar por componente nuevo `CrmSubheader` compacto (h-10, sólo contador a la derecha) o eliminarlo cuando no aporta.
- **Versionado**: `APP_VERSION` → `11.49.0` (minor por reducción de superficie). Entrada en `CHANGELOG.md` y en `src/pages/Changelog.tsx` (entrada al inicio del array, formato existente).

## Fuera de alcance
- No tocar lógica de negocio del trigger `trg_cotizacion_cierra_oportunidad` (ya entregado en 11.48.0).
- No agregar campos forwarder DNA (modalidad/lane/commodity) — eso es bloque A pendiente.
- No tocar permisos ni RLS.
- No tocar el detalle de oportunidad/lead (sólo se afinarán cuando haya señal del usuario).

## Archivos a tocar (estimado)
- **Editar (~10):** `CrmLayout.tsx`, `CrmDashboard.tsx`, `Leads.tsx`, `Oportunidades.tsx`, `Actividades.tsx`, `Analitica.tsx`, `Configuracion.tsx`, `leadsColumns.tsx`, `OportunidadKanban.tsx`, `nextBestActions.ts` (+ test), `QuickAddMenu.tsx`, `CHANGELOG.md`, `Changelog.tsx`, `appVersion.ts`.
- **Crear (~3):** `useCrmHotkeys.ts`, `CrmSubheader.tsx`, `useUpdateLeadEstado.ts`.
- **Eliminar (1):** `VencidasAlert.tsx`.

## Resultado esperado
- De ~11 bloques en dashboard a 6.
- De 3 botones de creación visibles a 1 (+ atajos).
- De 4 sub-tabs en Analítica a 0.
- De 3 sub-tabs en Configuración a 0.
- 2 acciones que antes eran modales (cambiar estado de lead, completar actividad) ahora son 1 clic en la tabla.
