

# Auditoría de Arquitectura — Post-Refactoring v7.0.0

## Estado actual

El refactoring v7.0.0 resolvió los problemas más críticos del audit anterior (AdminOrgDetalle monolítico, query keys hardcodeados, queries inline en Embarques, archivos estáticos obsoletos, ConfiguracionState, vinculación cotización en hook). La arquitectura está significativamente más limpia. Los hallazgos restantes son de criticidad menor a moderada.

---

## Hallazgos Pendientes

### 1. MODERADO — `AppRole` sigue definido localmente en 3 archivos

A pesar de crear `AppRole` centralizado en `src/data/types.ts`, tres archivos aún definen su propia versión local:

- `src/components/admin/AgregarMiembroOrgDialog.tsx` → `type AppRole = Enums<"app_role">`
- `src/pages/Usuarios.tsx` → `type AppRole = Enums<'app_role'>`
- `src/hooks/useUsuarios.ts` → `type AppRole = Enums<'app_role'>`

**Acción**: Reemplazar las 3 definiciones locales por `import type { AppRole } from "@/data/types"`.

### 2. MODERADO — Casts inseguros `(role as string) === "super_admin"` en 3 archivos

El tipo `AppRole` del `AuthContext` ya debería incluir `super_admin`, pero se siguen usando casts a `string` para comparar:

- `src/contexts/OrganizationContext.tsx` línea 41
- `src/components/ProtectedRoute.tsx` línea 28
- `src/components/AppSidebar.tsx` líneas 155-156

**Acción**: Dado que `AuthContext.role` ya es `AppRole | null` (que incluye `super_admin`), eliminar los casts `as string` y comparar directamente.

### 3. MENOR — Variable `containerTypes` mantiene nombre en inglés

En `StepDatosRuta.tsx` y `DialogDuplicarEmbarque.tsx`, la variable de hook se asigna como `containerTypes` (en inglés), rompiendo la convención de español del proyecto.

**Acción**: Renombrar a `tiposContenedor` para consistencia.

### 4. MENOR — `ShippingLineSelect` mantiene nombre en inglés

El componente `src/components/ShippingLineSelect.tsx` y sus props usan nombres en inglés, mientras el resto del proyecto usa español.

**Acción**: Renombrar a `NavieraSelect` (archivo y componente).

### 5. OPCIONAL — Helpers del test `useConfiguracionState.test.ts` duplican lógica del hook

Los tests de `useConfiguracionState` recrean `getVal` y `buildStateFromConfig` en lugar de importarlos. Si se exportaran como funciones puras del hook, los tests serían más fieles al código real.

**Acción**: Exportar `getVal` y `buildStateFromConfig` desde `useConfiguracionState.ts` y usarlos en el test.

---

## Resumen de Acciones (en orden)

| # | Prioridad | Acción | Archivos afectados |
|---|-----------|--------|--------------------|
| 1 | Moderada | Unificar AppRole desde `data/types.ts` | AgregarMiembroOrgDialog, Usuarios, useUsuarios |
| 2 | Moderada | Eliminar casts `as string` para super_admin | OrganizationContext, ProtectedRoute, AppSidebar |
| 3 | Menor | Renombrar `containerTypes` → `tiposContenedor` | StepDatosRuta, DialogDuplicarEmbarque |
| 4 | Menor | Renombrar `ShippingLineSelect` → `NavieraSelect` | ShippingLineSelect.tsx, StepDatosRuta.tsx |
| 5 | Opcional | Exportar helpers puros de useConfiguracionState | useConfiguracionState.ts, test |

## Lo que ya está bien

- AdminOrgDetalle correctamente descompuesto (280 líneas, hook separado)
- Query keys 100% centralizados en `queryKeys.ts`
- Queries de Embarques extraídas a `useEmbarquesListData`
- Archivos estáticos obsoletos eliminados
- ConfiguracionState extraído a hook
- Vinculación de cotización dentro del hook `useEmbarqueForm`
- ProtectedRoute acepta `AppRole[]` con tipado correcto
- Barrel exports consistentes (useEmbarques, useCotizaciones)
- Lazy loading, error handling, DataTable estandarizado

