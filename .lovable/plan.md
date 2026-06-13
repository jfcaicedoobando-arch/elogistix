# Auditoría Arquitectónica — Hallazgos fuera de `audit:all`

`bun run audit:all` está 100% verde (0 oversized, 0 imports directos, 0 casts HIGH, 0 duplicados de test). Esta auditoría se enfoca en lo que el pipeline automático **no** detecta: acoplamiento, misplaced logic, god hooks en zona de riesgo, duplicación estructural y cajones de sastre.

## Resumen ejecutivo


| Área                                    | Estado | Hallazgo principal                                                                                                                                                     |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Layer-first vs folder-style          | ❌      | 16 dominios en 4 carpetas espejo. CRM (137 archivos), cotizacion (97), portal (57) son los peores                                                                      |
| 2. Misplaced logic                      | ⚠️     | `pages/cxp/Cxp.tsx` 12 `useState` inline; `Papelera.tsx`/`Idempotencia.tsx` con `useQuery`/`useMutation` directos                                                      |
| 3. God hooks (150-200 líneas)           | ⚠️     | 10 hooks a 1 PR del guard: `useUpdateEmbarque` (198), `useNuevaFacturaProveedorForm` (193), `useNuevoProveedorController` (190)                                        |
| 4. Acoplamiento entre dominios          | ❌      | `services/tesoreria/{resumen,flujoProyectado}.ts` importan **directamente** `services/facturas` y `services/cxp`; `dashboard-ejecutivo` re-exporta tipos de 4 dominios |
| 5. Duplicación                          | ⚠️     | `lib/crm/` (12 archivos) y `lib/domain/` (11) = shadow-features; `lib/financial/` mezcla embarques + profit + IVA                                                      |
| 6. Services sin split queries/mutations | ⚠️     | `crm`, `facturas`, `cxp`, `tesoreria`, `admin` mezclan lecturas y escrituras                                                                                           |
| 7. Cajones de sastre                    | ⚠️     | `components/selects/{Naviera,Port}Select` son dominio; `components/shared/ProfitBadge` tiene reglas de negocio; `hooks/shared/useSidebarAlerts` es layout              |
| 8. `lib` con lógica de dominio          | ❌      | `lib/crm/`, `lib/domain/{cotizacion,proforma,estadoResultados,proyeccionFacturacion}`, `lib/facturacion/`, `lib/operaciones/`                                          |
| 9. Barrels                              | ✅      | Sin ciclos; sin self-imports en features                                                                                                                               |
| 10. Generators/PDF                      | ✅      | Limpios; sin Supabase, sin duplicación funcional                                                                                                                       |
| 11. Routing                             | ✅      | Split limpio, lazy consistente                                                                                                                                         |
| 12. Tipos                               | ⚠️     | `src/types/cotizacion*.ts` (5 archivos) drift vs `features/*/types/`                                                                                                   |


## Hallazgos críticos (detalle)

**CRÍTICO-1 — `lib/crm/` es feature sin padre.** 12 archivos de dominio (`cliente360`, `forecast`, `nextBestActions`, `oportunidadFormState`, etc.) viven fuera de cualquier feature mientras `crm` tiene 230+ archivos repartidos en 4 capas.

**CRÍTICO-2 — `lib/domain/` papelera multidominio.** `cotizacion.ts` (133L), `estadoResultados.ts` (183L), `proforma.ts`, `proyeccionFacturacion/` son reglas de negocio sin owner; sin convención, este directorio crece sin freno.

**CRÍTICO-3 — Acoplamiento service→service.**

```text
services/tesoreria/resumen.ts:9-10   → @/services/facturas, @/services/cxp
services/tesoreria/flujoProyectado.ts:12-13 → mismos
```

Cualquier cambio de firma en `fetchCobranza`/`fetchFacturasCxP` rompe tesorería sin señal en el grafo.

**ALTO-1..5** (detalle abreviado):

- `pages/cxp/Cxp.tsx` líneas 23-68 — 12 `useState` + memos sin controller
- `pages/admin/Papelera.tsx` líneas 46-75 — `useQuery`+2 `useMutation` inline
- `components/facturacion/TabCobranza.tsx` importa `useFacturasCxP` (cruce de dominios en UI)
- `services/dashboard-ejecutivo/types.ts:1-5` re-declara tipos de tesorería/presupuesto
- 16 dominios en layer-first; CRM/cotizacion/portal los más voluminosos

## Plan ordenado (CRÍTICO → OPCIONAL)

```text
CRÍTICO  →  Pasos 1, 2, 3, 4
ALTO     →  Pasos 5, 6
MEDIO    →  Pasos 7, 8
OPCIONAL →  Pasos 9, 10
```

### Paso 1 — Regla explícita para `src/lib/` (esfuerzo: trivial)

ADR + test de arquitectura: *"Solo entra en `lib/` lo que no tiene dominio dueño y es importado por ≥2 dominios distintos."* Frena la acumulación sin requerir migración inmediata.

### Paso 2 — Mover `lib/crm/` → `features/crm/domain/` (esfuerzo: bajo)

12 archivos, dependencias mecánicas. Habilita Paso 9 (migración CRM).

### Paso 3 — Extraer hook controllers para 3 páginas con state inline (esfuerzo: bajo)

- `hooks/cxp/useCxpPageState.ts` ← `Cxp.tsx`
- `hooks/admin/usePapelera.ts` ← `Papelera.tsx`
- `hooks/admin/useIdempotenciaLog.ts` ← `Idempotencia.tsx`

### Paso 4 — Romper acoplamiento `tesoreria → facturas/cxp` (esfuerzo: medio)

Nuevo `hooks/tesoreria/useTesoreriaSourceData.ts` que consume `useCobranza` + `useFacturasCxP` en paralelo (React Query) y pasa datos a funciones puras. `services/tesoreria/*.ts` dejan de importar otros servicios.

### Paso 5 — Aplicar patrón `*.helpers.ts`/`*.constants.ts` a los 10 god hooks (esfuerzo: medio)

Prioridad: `useUpdateEmbarque` (198L), `useNuevaFacturaProveedorForm` (193L), `useNuevoProveedorController` (190L), `useClienteDetalleController` (190L), `useEmbarqueSubmitOrchestrator` (190L), `useDialogGenerarProformaController` (181L), `useEditarEmbarqueWizard` (179L), `useOperacionesData` (174L), `useCotizacionWizardSteps` (163L), `useNuevoClienteController` (163L). Antes de que crucen 200.

### Paso 6 — Split `queries/`/`mutations/` en `services/{crm,cxp,tesoreria,facturas,admin}/` (esfuerzo: medio)

Modelo: `services/cotizacion/` y `services/embarques/`. Empezar por CxP y admin (más pequeños), terminar en CRM (20 archivos).

### Paso 7 — Reubicar `lib/financial/` por dominio (esfuerzo: bajo)

- `embarqueKpis.ts` → `features/embarques/domain/`
- `profitUtils.ts` → `lib/domain/profit.ts` (o futura `features/profit/domain/`)
- `costosUSD.ts` → `lib/domain/` si es cross, si no a embarques
- `financialUtils.ts` (IVA/totales) renombrado a `lib/financial/ivaUtils.ts`

### Paso 8 — Reubicar componentes/hooks mal-clasificados (esfuerzo: trivial)

- `components/selects/{Naviera,Port}Select.tsx` → `components/catalogos/`
- `components/shared/ProfitBadge.tsx` → `components/profit/`
- `hooks/shared/useSidebarAlerts.ts` → `hooks/layout/`
- `services/proforma/queries.ts`: eliminar re-export de `fetchDiasCreditoCliente`
- `lib/facturacion/` y `lib/operaciones/` → al servicio/feature dueño

### Paso 9 — Migrar CRM completo a `features/crm/` (esfuerzo: alto, 1-2 sprints)

Con Pasos 2+6 hechos. Colapsar `components/crm/`, `hooks/crm/`, `pages/crm/`, `services/crm/`, `lib/crm/` → `features/crm/{routes,components,hooks,services,domain,types}/`. Mayor ROI por volumen (137 archivos).

### Paso 10 — Consolidar `src/types/cotizacion*.ts` (esfuerzo: bajo, condicionado)

Hacerlo en el mismo PR que cree `features/cotizacion/`. No bloqueante hoy.

## Detalle técnico

- **No incluido**: cambios de UX, negocio, RLS, schema. Solo estructura.
- **Bump de versión + CHANGELOG** después de cada paso (regla del proyecto).
- **Guards a añadir** al cerrar pasos 1, 4 y 6: tests en `architecture.test.ts` que prohíban service→service imports cruzados y impongan la convención `queries/`/`mutations/` en services nuevos.

## Fuera de alcance

- Refactor de PDF, RLS, auth.
- Cambios funcionales o de negocio.
- Migrar tests existentes salvo los que se mueven con su feature.

Ejecuta todos los pasos en orden, avisame si tienes alguna duda