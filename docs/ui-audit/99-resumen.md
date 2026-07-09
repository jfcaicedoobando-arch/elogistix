# Auditoría UI · Resumen consolidado (Capas 0 → 3)

**Rango de versiones:** `v13.220.0` (baseline post-Capa 2) → `v13.226.0` (post-Lote 6)
**Periodo:** 08–09 / 07 / 2026
**Viewport de referencia:** 1920 × 1080 (autenticado, rol `admin_org`) + revisión estática de portales.
**Locale:** es-MX · **Marca:** Libre Carga

> Este documento cierra el ciclo de auditoría visual iniciado en `00-baseline.md`.
> Cada tranche (A–D) documentó hallazgos ruta-por-ruta y generó un "Lote" de correcciones aplicado inmediatamente después.
> Aquí se compendian los patrones canónicos, los hallazgos resueltos y las métricas delta.

---

## 1 · Estructura de la auditoría

| Capa | Documento | Alcance | Estado |
|---|---|---|---|
| 0 | `00-baseline.md` | Tokens, tipografía, radios, sombras, componentes base | ✅ Fuente de verdad |
| 1 | `01-transversal.md` | Layout global, sidebar, header, footer, breadcrumbs | ✅ Auditado |
| 2 | `02-componentes.md` | `PageHeader`, `PageContainer`, `DataTable`, `KpiCard`, `FormDialogShell` | ✅ Auditado |
| 3-A | `03-capa3-tranche-a.md` | `/inicio`, `/embarques`, `/cotizaciones` | ✅ Lote 3 aplicado |
| 3-B | `04-capa3-tranche-b.md` | `/facturacion`, `/cxp`, `/por-capturar` | ✅ Lote 4 aplicado |
| 3-C | `05-capa3-tranche-c.md` | `/clientes`, `/proveedores`, `/costeo/agentes` | ✅ Lote 5 aplicado |
| 3-D | `06-capa3-tranche-d.md` | `/portal/*`, `/agente/*` | ✅ Lote 6 aplicado |

---

## 2 · Patrones canónicos consolidados

Estos patrones quedaron **normalizados en toda la app** tras los 4 lotes:

### 2.1 · Header de página
- `PageContainer` (padding + `max-w-screen-2xl`) envolviendo `PageHeader`.
- `PageHeader` con **icon-tile** (`bg-accent/10 text-accent`, `size-10 rounded-lg`), título en `text-display`, `description` corta (una línea) y slot `actions` a la derecha.
- Contadores ("20 clientes registrados", "4 agentes") viven en `description` — nunca en un renglón aparte.

### 2.2 · Breadcrumbs
- Componente `Breadcrumbs` con separador chevron (`ChevronRight size-3.5`) y capitalización `toTitleCase` para segmentos dinámicos.
- Los portales heredan el mismo componente vía `PortalBreadcrumbsBar` / `AgenteLayout`.

### 2.3 · Tablas
- `DataTable` con densidad `comfortable` por defecto, `compact` opcional vía toggle.
- Zebra-striping en filas pares (`bg-muted/30`), row-click como acción primaria, dropdown de acciones con `e.stopPropagation()`.
- Placeholder de celdas vacías: `—` (em-dash), nunca `N/A` ni cadena vacía.
- Sin wrappers `<Card>` redundantes alrededor de la tabla.

### 2.4 · Filtros
- Barra superior con **buscador global** (`Input` con icono `Search`) + `Select` de filtros + botón "Más filtros" que abre `FiltrosSheet` en móvil.
- Debounce de 300 ms en el buscador.

### 2.5 · KPI cards
- Componente `KpiCard` compartido. Dos líneas para bimoneda (MXN arriba, USD abajo en `text-xs text-muted-foreground`).
- Paleta categórica (`kpi-info`, `kpi-success`, `kpi-accent`, `kpi-warning`, `kpi-secondary`, `kpi-danger`) — nunca semántica.

### 2.6 · Modales tipo formulario
- Siempre `FormDialogShell` + `FormDialogSection` (+ `FormDialogStepper` si es wizard). Ver `mem://style/form-dialog-shell`.

### 2.7 · Portales (Cliente + Agente)
- Layout paritario: sidebar/topbar propio + `PortalBreadcrumbsBar` + dropdown de usuario + footer dinámico con `orgName` + `v{APP_VERSION}`.
- Detalles usan `PageHeader` (no H1 manual).

---

## 3 · Hallazgos resueltos por tranche

### Tranche A — `v13.221.0` → `v13.222.0` (Lote 3)
| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| A-01 | HIGH | Glyph roto (emoji) en saludo `/inicio` | ✅ Reemplazado por icono lucide |
| A-02 | HIGH | KPIs de embarques sin bimoneda consistente | ✅ Normalizado a 2 líneas |
| A-03 | MED | Tipografía divergente en headers de `/cotizaciones` | ✅ Migrado a `PageHeader` |
| A-04 | MED | Chips de estado con colores hardcodeados | ✅ Tokens `state-*` |
| A-05 | LOW | Densidad inconsistente en tabla de embarques | ✅ `comfortable` default |

### Tranche B — `v13.223.0` → `v13.224.0` (Lote 4)
| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| B-01 | MED | KPI strip mezcla números y mini-chart en `/facturacion` | ✅ Sparkline movido a fila secundaria |
| B-02 | MED | 8 tabs en un renglón con `?` redundantes | ✅ Group labels reubicados |
| B-03 | HIGH | `/cxp` sin `PageHeader` canónico | ✅ Migrado |
| B-04 | MED | `/por-capturar` con columnas divergentes | ✅ Config unificada |
| B-05 | LOW | Registro de estatus inconsistente | ✅ `statusRegistry.ts` centralizado |

### Tranche C — `v13.225.0` (Lote 5)
| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| C-01 | HIGH | 3 directorios con 3 headers distintos | ✅ Unificados a `PageHeader` |
| C-02 | MED | `/costeo/agentes` sin `PageContainer` | ✅ Envuelto |
| C-03 | MED | Buscador ausente en `/clientes` y `/agentes` | ✅ Agregado con debounce |
| C-04 | MED | Densidad ~30% más alta en agentes | ✅ Normalizada |
| C-05 | LOW | Capitalización mixta en breadcrumbs | ✅ `toTitleCase` |

### Tranche D — `v13.226.0` (Lote 6)
| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| D-01 | HIGH | Detalles de portal cliente sin `PageHeader` | ✅ Migrados |
| D-02 | HIGH | `AgenteLayout` divergente de `PortalLayout` | ✅ Paridad completa |
| D-03 | MED | `AgenteInicio` con KPIs ad-hoc | ✅ `KpiCard` compartido |
| D-04 | MED | Filtros móviles ausentes en `/portal/cotizaciones` | ✅ `PortalCotizacionesMobileFilters` |
| D-05 | MED | Wrappers `<Card>` redundantes en tablas de portal | ✅ Eliminados |
| D-06 | LOW | Marca "Libre Carga" hardcodeada en footer de agente | ✅ Dinámica vía `orgName` |
| D-07 | LOW | Tamaños tipográficos hardcodeados (`text-[11px]`, `size-4`) | ✅ Tokens semánticos |

**Total: 22 hallazgos resueltos** (5 HIGH · 12 MED · 5 LOW).

---

## 4 · Métricas delta

| Métrica | Baseline (`v13.220.0`) | Post-Lote 6 (`v13.226.0`) | Δ |
|---|---|---|---|
| Rutas con `PageHeader` canónico | 12 / 27 | 27 / 27 | **+15** |
| Rutas con `PageContainer` | 18 / 27 | 27 / 27 | **+9** |
| Componentes con H1 manual | 14 | 0 | **−14** |
| Tablas envueltas en `<Card>` redundante | 9 | 0 | **−9** |
| Emojis en UI (fallback roto) | 3 | 0 | **−3** |
| Marcas hardcodeadas en footers | 4 | 0 | **−4** |
| Tokens tipográficos hardcodeados (`text-[Npx]`) | 27 | 0 | **−27** |
| Densidades de tabla distintas | 4 | 2 (`comfortable`/`compact`) | **−2** |

Archivos tocados a lo largo de los 4 lotes: **~62 archivos** (`.tsx` + `.ts` + docs).

---

## 5 · Estado final del sistema

- ✅ **Coherencia visual** entre módulo interno, portal cliente y portal agente.
- ✅ **Tokens semánticos** aplicados 100% (color, tipografía, radios, sombras).
- ✅ **Componentes base** (`PageHeader`, `PageContainer`, `DataTable`, `KpiCard`, `FormDialogShell`) usados como única fuente.
- ✅ **Breadcrumbs, footer, versionado** unificados vía `APP_VERSION`.
- ✅ **Accesibilidad básica** mejorada: `<Link>` en tarjetas navegables, `aria-label` en icon-buttons, `stopPropagation` en dropdowns de tabla.

---

## 6 · Backlog fuera del alcance

Elementos observados pero **no auditados** en este ciclo:

- **Modo oscuro:** las tranches se hicieron en light-mode. Se sugiere Capa 4 dedicada a dark.
- **Vistas móviles < 640 px:** validadas solo puntualmente (filtros de portal). Requiere pasada completa.
- **Impresión / PDF:** los reportes tienen su propio pipeline (`pdf-generation-standards`) fuera del alcance de UI web.
- **Accesibilidad AA/AAA:** contraste y navegación por teclado no medidos con herramienta automatizada.

---

## 7 · Recomendaciones para mantener la coherencia

1. **Regla de oro:** cualquier ruta nueva debe usar `PageContainer` + `PageHeader` + `DataTable`/`FormDialogShell`. Sin excepciones.
2. **PR checklist:** agregar item "¿esta pantalla se ve como el resto?" con link a este resumen.
3. **Test snapshot** de las 27 rutas en Playwright a 1920×1080 como *smoke test* visual (opcional, Capa 4).
4. **Auditoría trimestral** ligera (~2 h) revisando solo hallazgos nuevos, no re-auditar todo.

---

**Cierre:** el sistema pasa de "colección de módulos" a "producto con lenguaje visual único". El costo total en versiones fue de 6 minor bumps y ~62 archivos, sin cambios de lógica de negocio.
