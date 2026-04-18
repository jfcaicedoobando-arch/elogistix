

## Auditoría arquitectónica post-Fase 6 (v8.19.0)

**Estado general**: La arquitectura está en muy buen estado tras 6 fases de refactor. No hay deuda crítica. Lo que queda son mejoras incrementales de organización y polish.

### ✅ Resuelto (verificado)
- Páginas de detalle <250 líneas con hooks orquestadores
- `lib/`, `services/`, `generators/` separados por responsabilidad
- Edge functions con `_shared/` (cors, response, auth)
- Sin acceso directo a Supabase desde UI (solo `Login.tsx`, intencional)
- 132 tests pasando, FormProvider eliminó prop-drilling

### 🟡 Hallazgos pendientes (ordenados por prioridad)

**1. Componentes grandes con responsabilidades mezcladas** (alto impacto)
- `src/pages/Embarques.tsx` (357 líneas, 15 useState/useMemo): mezcla filtros, paginación, columnas DataTable, dropdowns de acción y diálogos. Extraer:
  - `embarqueColumns.tsx` (definición de columnas como en `clienteColumns.tsx`)
  - `useEmbarquesPageState.ts` (filtros + paginación + debounce)
  - `EmbarqueRowActions.tsx` (dropdown duplicar/eliminar/editar)
- `src/components/embarque/StepDatosGenerales.tsx` (335 líneas): contiene 3 sub-bloques (cliente+contactos, mercancía, vinculación a expedientes). Dividir en sub-secciones.
- `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx` (318 líneas): tiene 10 props "actualizar/agregar/eliminar × USD/MXN". Unificar con un solo `useFieldArray`-like manager o reducer.
- `src/components/operaciones/DesempenoOperadores.tsx` (307 líneas) y `PortalDashboard.tsx` (316 líneas): mezclan lógica de cómputo + render. Extraer `useDesempenoChartData()` y `usePortalDashboardKpis()`.

**2. Acoplamiento de tipos entre capas** (medio)
- `src/lib/cotizacionFormMappers.ts` importa `FilaCostoLocal` desde `@/components/cotizacion/SeccionCostosInternosPLUnificado`. **Inversión de dependencia**: lib no debe depender de components. Mover el tipo a `src/data/conceptoTypes.ts` o `src/lib/types/cotizacion.ts`.
- `EmbarqueFormValues` vive en `src/lib/embarqueMappers.ts` pero también se re-exporta desde `useEmbarqueForm`. Crear `src/types/` central para form values cross-cutting.

**3. Barrel hooks sobre-expuestos** (medio)
- `useEmbarques.ts` y `useCotizaciones.ts` re-exportan ~20 símbolos cada uno. Consumidores importan `EmbarqueRow`, `calcularEstadoEmbarque` y mutaciones desde el mismo barrel, escondiendo dependencias reales y rompiendo tree-shaking. Recomendación: dejar barrel solo para tipos comunes, importar hooks específicos directo.

**4. Mappers/parsers duplicados** (medio)
- `src/lib/embarqueMappers.ts` (241 líneas) y `src/lib/mappers/cotizacionMappers.ts` viven en niveles distintos. Consolidar todo en `src/lib/mappers/{embarque,cotizacion,conceptos}.ts`.
- `src/lib/dashboardParsers.ts` y `src/lib/cotizacionDetalleHelpers.ts` son parsers + cálculos. Mover a `src/lib/parsers/`.

**5. Constantes domain-specific en components** (bajo)
- `MODOS`, `TIPOS`, `INCOTERMS`, `UNIDADES_MEDIDA` están hardcoded en componentes de wizard. Centralizar en `src/data/embarqueConstants.ts` y `cotizacionConstants.ts` (ya existen).

**6. Tokens semánticos incompletos** (bajo)
- `DesempenoOperadores.tsx` mezcla `hsl(var(--info))` con valores HSL crudos (`hsl(199 89% 48%)`). Definir tokens `--state-llegada`, `--state-en-proceso`, `--state-cerrado` en `index.css`.
- `PortalDashboard.tsx` usa `text-violet-600`, `text-amber-600`, `bg-amber-100` directos en lugar de tokens.

**7. `changelogData.ts` (1825 líneas)** (bajo, opcional)
- Crece sin límite. Considerar dividir por año (`changelog/2025.ts`, `changelog/2026.ts`) y unir con barrel.

**8. Hooks sin agrupar** (opcional)
- `src/hooks/` tiene 60+ archivos planos. Agrupar por dominio:
  ```
  hooks/
    cotizacion/   (12 archivos useCotizacion*)
    embarque/     (10 archivos useEmbarque*)
    portal/       (3 archivos usePortal*)
    admin/        (useAdminData, useAdminOrgDetalle)
    config/       (useConfiguracion*)
    shared/       (useDebounce, usePermissions, useBitacora, useToast)
  ```

**9. Edge functions: validación de input** (bajo)
- `_shared/` tiene cors/auth/response pero falta `validate.ts` con helpers Zod-like para parsear bodies. Hoy cada función valida ad-hoc.

**10. Tests faltantes** (opcional)
- `useCotizacionWizardSteps`, `useEmbarqueEstadoActions`, `useEmbarqueDocumentosActions`, `embarqueLogic.ts` (cálculo de estado) sin cobertura.

### 📋 Plan ordenado de ejecución sugerido

| # | Acción | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Descomponer `Embarques.tsx` (columnas + state hook + acciones) | M | Alto |
| 2 | Descomponer `StepDatosGenerales.tsx` y `SeccionConceptosVentaCotizacion.tsx` | M | Alto |
| 3 | Mover `FilaCostoLocal` y `EmbarqueFormValues` a capa de tipos neutra | S | Medio |
| 4 | Extraer hooks de cómputo de `DesempenoOperadores` y `PortalDashboard` | S | Medio |
| 5 | Consolidar mappers/parsers en `lib/mappers/` y `lib/parsers/` | S | Medio |
| 6 | Reducir barrels (`useEmbarques`, `useCotizaciones`) a solo tipos | S | Medio |
| 7 | Centralizar constantes (MODOS/TIPOS/INCOTERMS/UNIDADES) en `data/` | XS | Bajo |
| 8 | Definir tokens semánticos faltantes en `index.css` y migrar usos | S | Bajo |
| 9 | Agrupar `src/hooks/` por dominio | M | Bajo (DX) |
| 10 | Dividir `changelogData.ts` por año | XS | Opcional |
| 11 | Agregar `_shared/validate.ts` para edge functions | S | Bajo |
| 12 | Tests para hooks de wizard/estado y `embarqueLogic` | M | Medio |

**Recomendación**: ejecutar **#1-#6** como Fase 7 (impacto real en mantenibilidad). Dejar #7-#12 como polish opcional para cuando aparezcan oportunidades naturales.

