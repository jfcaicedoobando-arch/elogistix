# Audit Report — 12.98.3

Generado: 2026-06-13T04:35:12.540Z

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ✅ | 0 archivos |
| Capa (Supabase directo en components/pages) | ✅ | 0 archivos |
| Power-of-10 (>200 líneas) | ✅ | 0 archivos |
| Casts HIGH + CRITICAL | ✅ | 0 / 1374 |
| Higiene de tests | ✅ | 0 violaciones |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
✅ Ninguno

### Components/Pages con import directo a Supabase
✅ Ninguno

### Archivos productivos > 200 líneas
✅ Ninguno

## Casts

Total: **1374** — HIGH: **0**, CRITICAL: **0**

| Severidad | Cantidad |
|---|---:|
| SAFE | 466 |
| LOW | 22 |
| MEDIUM | 886 |
| HIGH | 0 |
| CRITICAL | 0 |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
| 1 | `src/features/cotizacion/services/__tests__/informativa.test.ts` | 10 | 20 |
| 2 | `src/services/pagos-factura/__tests__/pagosFactura.test.ts` | 11 | 20 |
| 3 | `src/services/profit/estadoResultadosDevengado.ts` | 10 | 20 |
| 4 | `src/test/setup.ts` | 10 | 20 |
| 5 | `src/lib/mappers/genericPayloadMapper.ts` | 11 | 19 |
| 6 | `src/features/facturas/services/huecoFacturacion/__tests__/buildFilas.test.ts` | 8 | 16 |
| 7 | `src/hooks/profit/__tests__/useProfit.test.tsx` | 8 | 16 |
| 8 | `src/features/facturas/services/__tests__/facturasIndex.test.ts` | 7 | 14 |
| 9 | `src/lib/sentry.ts` | 7 | 14 |
| 10 | `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.test.ts` | 6 | 12 |

## Tests

✅ Sin violaciones.

---

## Cierre del plan de remediación (13.56.1 → 13.56.7)

Los 20 hallazgos del plan de auditoría arquitectónica quedaron atendidos:

| # | Severidad | Atendido en | Resumen |
|---:|---|---|---|
| 1 | 🔴 Crítico | 13.56.1 | `TabSeguridadGlobal` — init de estado movido a `useEffect`. |
| 2 | 🔴 Crítico | 13.56.1 | 5 servicios financieros sin `SELECT *` (columnas explícitas). |
| 3 | 🔴 Crítico | 13.56.1 | Tests para cierre, seguros, timbrado y reglas de `TabCierre`. |
| 4 | 🟠 Alto | 13.56.4 | Cobertura ampliada en `operaciones`/`reportes`. |
| 5 | 🟠 Alto | 13.56.2 | `TabPnl` reducido 289 → 138 líneas (split en `pnl/*`). |
| 6 | 🟠 Alto | 13.56.2 | Desacoplado `comisiones → admin` vía `services/usuario`. |
| 7 | 🟠 Alto | 13.56.2 | Página de Facturación movida a `features/facturacion/routes/`. |
| 8 | 🟠 Alto | 13.56.3/5 | Paginación defensiva en planes, portal, proveedor operaciones. |
| 9 | 🟠 Alto | 13.56.2/8 | `appRoutes.tsx` reducido a 103 líneas (CRM extraído + helper `guarded()`). |
| 10 | 🟡 Medio | 13.56.3/6 | Tokens semánticos (`text-success`, etc.) en cierre y KPI ejec. |
| 11 | 🟡 Medio | 13.56.6 | Capa canónica `src/lib/{ui,auth,diagnostics}/` con re-exports. |
| 12 | 🟡 Medio | 13.56.4 | `useCotizacionesPageController` dividido en hooks especializados. |
| 13 | 🟡 Medio | 13.56.3 | `useCierreDialog` encapsula los 4 `useState` de `TabCierre`. |
| 14 | 🟡 Medio | 13.56.4 | `CosteoRutas` reducido 195 → 90 líneas (`RutaFormDialog`). |
| 15 | 🟡 Medio | 13.56.6 | `TabCierre` ≤170 líneas (`CierreChecklistCard`, `CierreHistorialCard`). |
| 16 | 🟡 Medio | 13.56.6 | Tests presupuesto: categorías, mensual, hook `usePresupuestoVsReal`. |
| 17 | 🟢 Bajo | 13.56.7 | TODOs consolidados en `.lovable/audit-todos.md` con prefijo `AUDIT()`. |
| 18 | 🟢 Bajo | 13.56.7 | Casts auditados — 0 HIGH/CRITICAL, MEDIUM en patrones aceptados. |
| 19 | 🟢 Bajo | 13.56.7 | `console.log` sólo en tests/perf (legítimos); productivo usa `logger`. |
| 20 | 🟢 Bajo | 13.56.7 | Sección "Cómo extender" añadida a `CONTRIBUTING.md`. |

_Estado general: ✅ Baseline arquitectónico limpio._
