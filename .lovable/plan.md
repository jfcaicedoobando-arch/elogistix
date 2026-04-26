# Auditoría arquitectónica — abril 2026 (post v8.78.0)

## Estado general: muy saludable

Lo que ya está limpio (no requiere acción):

- **0 imports directos a Supabase** desde `hooks/`, `components/`, `pages/`.
- **0 imports de `sonner`** (toasts unificados).
- **0 colores Tailwind hardcodeados** en `components/` y `pages/`.
- **0 componentes UI huérfanos** en `src/components/ui/`.
- **0 `console.log` / `: any` / `TODO`** en código de producción (los 2 `console.error` que quedan están justificados: ErrorBoundary y NotFound).
- **0 `useEffect` en páginas** salvo NotFound (logging legítimo).
- **196/196 tests** pasando, `tsc` limpio.

Lo que sigue es **deuda residual menor**.

## Hallazgos

### Críticos

**C1 — `useNuevoEmbarqueWizard.ts` volvió a 298 LOC**

Tras el adelgazamiento de v8.73 (314 → 290), se reincorporaron ~8 líneas y vuelve a estar por encima del guardrail de 250. Es el único hook del repo que lo supera. Propuesta: extraer un sub-hook `useEmbarqueSubmitOrchestrator` que encapsule la cadena `resolverExpediente → subirDocumentos → createEmbarque → updateEstadoCotizacion → registrarActividad`.

### Medios

**M1 — Páginas de listado con responsabilidades mezcladas**

4 páginas repiten el mismo patrón inline (filtros + paginación + ordenamiento + diálogo de eliminar):

- `Cotizaciones.tsx` (244 LOC, 7 `useState`, 14 hooks/dialogs)
- `Embarques.tsx` (241 LOC) — ya tiene `useEmbarquesPageState`, parcial
- `Facturacion.tsx` (233 LOC)
- `ClienteDetalle.tsx` (230 LOC, 6 `useState`, 24 referencias a state/dialogs)

Patrón común: `search + filterEstado + filterCliente + page + pageSize + recordAEliminar`. Extraer un hook genérico `useListPageState<TFilter>()` o controllers específicos por página (`useCotizacionesPageState`, `useFacturacionPageState`, `useClienteDetallePageState`).

**M2 — `PortalCotizacionDetalle.tsx` volvió a 266 LOC**

Tras la extracción de v8.74 a `usePortalCotizacionDetalleController`, la página subió de nuevo por encima de 250. Revisar qué se reincorporó (probable JSX o sub-componentes) y mover lo derivable al controller o partir el JSX en sub-componentes (`AceptarRechazarPanel`, `CotizacionConceptosSummary`).

### Opcionales

**O1 — `adminServices.ts` (212 LOC, 17 funciones exportadas)**

Mezcla 3 dominios distintos: KPIs globales, organizaciones (CRUD + activar) y miembros de organización (CRUD + roles). Split sugerido:

```text
src/services/admin/
  ├── stats.ts       (fetchAdminDashboardStats, count*)
  ├── organizations.ts (fetch/create/update/setActivo)
  └── members.ts     (fetchOrgMembers, addOrgMember, update/removeRole)
src/services/adminServices.ts → barrel
```

Mismo patrón aplicado ya con éxito a `embarqueServices` y `proformaServices`.

**O2 — `clienteService.ts` (201 LOC, 16 funciones)**

Misma señal: mezcla CRUD de clientes + contactos + queries relacionadas (embarques/cotizaciones del cliente). Split análogo:

```text
src/services/cliente/
  ├── crud.ts       (fetch/create/update + paginación)
  ├── contactos.ts  (fetch/create/update/delete contactos)
  └── relacionados.ts (embarques + cotizaciones del cliente)
```

**O3 — `services/cotizacion/conversiones.ts` (225 LOC)**

Cerca del límite. Si crece más, dividir por tipo de conversión.

**O4 — Naming inconsistente en `src/types/`**

8 archivos con sufijo `Types.ts` (`cotizacionTypes`, `clienteFormTypes`, etc.) más 2 sin sufijo (`appRole.ts`, `types.ts` deprecado). Decidir convención única — recomendado: **sin sufijo `Types`** (más idiomático TS y consistente con `appRole.ts`):

```text
cotizacionTypes.ts → cotizacion.ts
clienteFormTypes.ts → clienteForm.ts
conceptoTypes.ts → concepto.ts
...
```

Mantener `types.ts` deprecado solo durante este ciclo y eliminarlo al final.

## Plan de acción ordenado

| # | Versión | Acción | Riesgo | Impacto |
|---|---------|--------|--------|---------|
| 1 | v8.79.0 | **C1**: Extraer `useEmbarqueSubmitOrchestrator` de `useNuevoEmbarqueWizard`. | Medio | Alto | ✅ |
| 2 | v8.80.0 | **M2**: Reducir `PortalCotizacionDetalle.tsx` bajo 250 LOC (sub-componentes o más controller). | Bajo | Medio |
| 3 | v8.81.0 | **M1**: Controller `useListPageState` genérico + migración de 4 páginas. | Medio | Alto (DX) |
| 4 | v8.82.0 | **O1**: Split `adminServices.ts` en `services/admin/{stats,organizations,members}` + barrel. | Bajo | Medio |
| 5 | v8.83.0 | **O2**: Split `clienteService.ts` en `services/cliente/{crud,contactos,relacionados}` + barrel. | Bajo | Medio |
| 6 | v8.84.0 | **O4**: Renombrar `src/types/*Types.ts` → `src/types/*.ts` y eliminar `types.ts` deprecado. | Muy bajo | Bajo (DX) |

## Convenciones a respetar (recordatorio)

- Guardrail de **250 LOC** por archivo (excepto `sidebar.tsx` shadcn y `supabase/types.ts` autogenerado).
- **Cero** imports directos a Supabase fuera de `services/`.
- Toasts solo vía `useToast`.
- Colores solo vía tokens semánticos / `kpi.*`.
- Cada cambio incrementa `changelogData.ts` (recientes) o el archivo de versión correspondiente.

## Próximo paso

Ejecutar el **Paso 2 (v8.80.0)** — reducir `PortalCotizacionDetalle.tsx` (266 LOC) bajo el guardrail de 250.
