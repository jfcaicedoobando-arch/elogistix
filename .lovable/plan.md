## Power of 10 — Fase 4 (iteración 6, v8.150.0)

Cerrar los **5 componentes >200 líneas** que quedan en la baseline para llegar a **0 hallazgos en Regla #4**.

### Objetivos

| Componente | Líneas | Refactor propuesto |
|---|---:|---|
| `pages/portal/PortalEmbarqueDetalle.tsx` | 239 | Extraer `usePortalEmbarqueDetalleController` + subcomponentes (`PortalEmbarqueHeader`, `PortalEmbarqueResumenCards`, `PortalEmbarqueTabs`) |
| `pages/cotizaciones/CotizacionDetalle.tsx` | 219 | Mover lógica/queries a `useCotizacionDetalleController` (si no existe ya completo) y partir UI en `CotizacionDetalleHeader` + `CotizacionDetalleResumen` |
| `components/facturacion/TabProyeccion.tsx` | 217 | Extraer filas/celdas a `TabProyeccionRow.tsx` y la cabecera de mes a `TabProyeccionHeader.tsx`; el controller `useTabProyeccionController` ya existe |
| `components/cotizacion/cotizacionesColumns.tsx` | 209 | Partir definiciones de columnas en `cotizacionesColumns/base.tsx`, `acciones.tsx` y `estadoCell.tsx`; reexportar desde el index |
| `pages/clientes/ClienteDetalle.tsx` | 206 | Extraer `ClienteDetalleHeader` y `ClienteDetalleTabs` (controller `useClienteDetalleController` ya existe) |

### Convenciones (sin cambios de UI)

- Shells delgados (<150 líneas) que sólo orquesten controller + subcomponentes.
- Subcomponentes en subcarpetas por dominio (`portal/embarqueDetalle/`, `cotizacion/detalle/`, `facturacion/proyeccion/`, `cotizacion/columnsParts/`, `cliente/detalle/`).
- API pública intacta: imports existentes siguen funcionando.
- Sin tocar lógica de negocio, queries, RLS ni estilos.

### Mantenimiento

- Bump `APP_VERSION` → `8.150.0`.
- Nueva entrada en `src/content/changelog/v8/chunks/0.ts` y rotación de `recentChangelog` (mantener ≤10).
- Re-ejecutar `scripts/audit-power10.ts` para confirmar **0 componentes >200 líneas** y actualizar `docs/power10-baseline.md`.
- Verificar `bunx vitest run` (esperado: 314 verdes).

### Fuera de alcance

- Regla #2 (68 queries sin paginar en services): se aborda en una fase posterior dedicada — requiere decisiones de UX por endpoint.
- Regla #3 (`AuthContext.tsx:52`): revisar aparte; probablemente falso positivo (cleanup vive en helper externo).

### Resultado esperado

Baseline Regla #4 pasa de **5 → 0**. Cierre de la limpieza estructural por tamaño de componente.
