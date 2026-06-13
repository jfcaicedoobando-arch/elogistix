---
name: Audit Pendings
description: Estado de la auditoría arquitectónica del proyecto y pendientes diferidos
type: reference
---

**Estado: CERRADA en 12.95.19** — los 10 pasos del plan original están completos.

## Diferidos opcionales (no en plan original)

- `lib/facturacion/` y `lib/operaciones/` → mover al feature/servicio dueño (requiere rediseño de ownership entre facturación y operaciones, no es `mv` trivial).
- `lib/financial/profitUtils.ts` → `features/profit/` cuando exista esa feature.
- `lib/domain/{cotizacion,proforma,estadoResultados,proyeccionFacturacion}` → al feature dueño cuando se complete su migración folder-style.

## Estructura folder-style consolidada

Features completas en `src/features/<dominio>/{components,hooks,services,domain,routes,types}`:
- `embarques` (referencia canónica)
- `crm` (migrado en 12.95.19: 137 archivos)

## Garantías activas
- `bun run audit:arch`
- `src/lib/__tests__/architecture.test.ts` (7 reglas)
- ESLint `no-restricted-imports`

Ver `.lovable/plan.md` para detalle versión-por-versión.
