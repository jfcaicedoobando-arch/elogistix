

# Auditoría de Arquitectura del Codebase

## Resumen General

La arquitectura es sólida y bien modularizada para un proyecto de este tamaño. Los patrones de hooks, barrel exports, query key factory y separación de concerns están bien establecidos. Los problemas encontrados son incrementales, no sistémicos.

---

## Hallazgos Ordenados por Criticidad

### 1. CRÍTICO — `AdminOrgDetalle.tsx` es un monolito con lógica inline (477 líneas)

Este archivo concentra 7 queries, 3 mutations, lógica de edición, columnas de tabla y todo el JSX en un solo componente de página. Viola el patrón establecido en el resto del proyecto (hooks extraídos, sub-componentes atómicos).

**Recomendación**: Extraer un `useAdminOrgDetalle(id)` hook con todas las queries/mutations, y separar las secciones de UI (KPIs, Info general, Miembros, Configuración) en sub-componentes.

### 2. CRÍTICO — Query keys hardcodeados en admin pages

`AdminOrgDetalle.tsx`, `AdminOrganizaciones.tsx` y `AdminUsuarios.tsx` usan strings inline (`"admin-org"`, `"admin-org-members"`, `"admin-organizations"`, `"admin-all-users"`) en lugar del `queryKeys` factory centralizado. Esto rompe la convención del proyecto y hace frágil la invalidación de caché.

**Recomendación**: Agregar sección `admin` al `queryKeys.ts` factory y migrar todos los admin pages.

### 3. MODERADO — Queries inline en `Embarques.tsx` (liquidación + docs)

Las queries de `embarques-liquidacion` y `embarques-docs-status` (líneas 95-134) están definidas inline en la página en lugar de extraerse a hooks. También usan query keys hardcodeados.

**Recomendación**: Mover a `useEmbarqueQueries.ts` o crear un `useEmbarquesListSupplementary(ids)` hook.

### 4. MODERADO — Archivos estáticos obsoletos sin consumidores

`src/data/shippingLines.ts` y `src/data/containerTypes.ts` ya no se importan en ningún componente de producción (solo en tests). Fueron reemplazados por los hooks `useNavieras` y `useTiposContenedor` que leen de la BD.

**Recomendación**: Eliminar ambos archivos y sus tests (`shippingLines.test.ts`, `containerTypes.test.ts`).

### 5. MODERADO — `Configuracion.tsx` mezcla lógica de estado con UI

La página define `getVal()`, `buildStateFromConfig()`, y `ConfigState` inline. Este patrón no sigue la convención de hooks extraídos usada en el resto del proyecto.

**Recomendación**: Mover la lógica de estado a un `useConfiguracionState()` hook.

### 6. MENOR — Tipo `AppRole` definido en múltiples lugares

`AppRole` se define localmente en `AuthContext.tsx`, `AdminOrgDetalle.tsx`, y `usePermissions.ts` como strings manuales. Debería derivarse del enum de la BD (`Enums<"app_role">`).

**Recomendación**: Crear un solo `export type AppRole = Enums<"app_role">` en `src/data/types.ts` y reutilizar.

### 7. MENOR — Cast inseguro `"super_admin" as "admin"` en `App.tsx`

Línea 67: `allowedRoles={["super_admin" as "admin"]}` es un hack de tipado. Indica que `ProtectedRoute` no soporta `super_admin` como rol válido en su tipado.

**Recomendación**: Corregir el tipo de `allowedRoles` en `ProtectedRoute` para aceptar todos los roles válidos incluyendo `super_admin`.

### 8. MENOR — `NuevoEmbarque.tsx` tiene lógica de vinculación de cotización inline

Los callbacks `handleVincularCotizacion` y `handleDesvincularCotizacion` con sus 12+ `setValue` cada uno podrían vivir dentro de `useEmbarqueForm` como métodos del hook.

**Recomendación**: Mover al hook `useEmbarqueForm` para reducir la complejidad de la página.

### 9. OPCIONAL — Tests de datos estáticos obsoletos

`src/data/__tests__/containerTypes.test.ts` y `shippingLines.test.ts` validan archivos que ya no se usan en producción.

**Recomendación**: Eliminar junto con los archivos estáticos (punto 4).

### 10. OPCIONAL — Falta barrel export para hooks de admin

Los hooks `usePlanes`, `useConfiguracionGlobal`, `useConfiguracionOrg` no tienen un barrel como los de embarques/cotizaciones. No es urgente dado que el módulo admin es más pequeño.

---

## Resumen de Acciones Propuestas (en orden)

| # | Prioridad | Acción | Archivos |
|---|-----------|--------|----------|
| 1 | Crítica | Extraer hook + sub-componentes de AdminOrgDetalle | AdminOrgDetalle.tsx → hook + 3-4 componentes |
| 2 | Crítica | Centralizar query keys de admin en queryKeys.ts | queryKeys.ts, 3 admin pages |
| 3 | Moderada | Extraer queries inline de Embarques.tsx a hooks | Embarques.tsx, useEmbarqueQueries.ts |
| 4 | Moderada | Eliminar archivos estáticos obsoletos | shippingLines.ts, containerTypes.ts + tests |
| 5 | Moderada | Extraer lógica de estado de Configuracion.tsx | Configuracion.tsx → hook |
| 6 | Menor | Unificar tipo AppRole desde la BD | types.ts, AuthContext, usePermissions, AdminOrgDetalle |
| 7 | Menor | Corregir cast inseguro en App.tsx | App.tsx, ProtectedRoute.tsx |
| 8 | Menor | Mover lógica de vinculación cotización al hook | NuevoEmbarque.tsx, useEmbarqueForm.ts |

## Lo que está bien hecho

- Query key factory centralizado (para módulos principales)
- Barrel exports consistentes (useEmbarques, useCotizaciones)
- Hooks modulares (queries/mutations/utils separados)
- Componentes reutilizables (DataTable, SearchInput, PaginationControls)
- Separación clara entre data layer, hooks y UI en módulos core
- Lazy loading por ruta
- Error handling estandarizado con `getErrorMessage`

