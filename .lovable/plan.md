# Plan: Migración folder-style — CERRADO ✅

Completado en v12.96.0 → v12.96.6 (todas las fases en una iteración).

| Fase | Dominio | Versión | Estado |
| ---- | ------- | ------- | ------ |
| 1 | proveedor | 12.96.0 | ✅ |
| 2 | cliente | 12.96.1 | ✅ |
| 3 | cxp | 12.96.2 | ✅ |
| 4 | tesoreria | 12.96.3 | ✅ |
| 5 | portal | 12.96.4 | ✅ |
| 6 | cotizacion | 12.96.5 | ✅ |
| 7 | facturacion + facturas | 12.96.6 | ✅ |

## Resultado

Todos los dominios listados ahora viven bajo `src/features/<dominio>/{hooks,services,components,types}` con barrel `index.ts`. Las páginas (`src/pages/<dominio>/*.tsx`) permanecen como rutas y consumen vía `@/features/<dominio>/…`.

## Diferidos (sin plan activo)

- `lib/facturacion/`, `lib/operaciones/`, `lib/financial/profitUtils.ts`: requieren rediseño de ownership; no se migran hasta tocarse por motivo funcional.
- `lib/domain/cotizacion.ts`, `lib/domain/proforma.ts`, etc.: se mantienen en `lib/domain/` por ser lógica pura compartida entre features.

Abrir nuevo plan cuando aparezcan hallazgos en `audit:all`.
