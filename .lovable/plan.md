

## Auditoría Arquitectónica — Reporte Post-Refactoring v8.2.0

La auditoría anterior (v8.2.0) corrigió los problemas más críticos. Esta revisión identifica la deuda técnica restante y nuevas oportunidades de mejora.

---

### Hallazgos ordenados por criticidad

#### 1. ALTO — `estadoColor` duplicado 3 veces en el portal

`PortalCotizaciones.tsx`, `PortalCotizacionDetalle.tsx` y `PortalFacturas.tsx` cada uno define su propio mapa `estadoColor` inline con estilos **ligeramente distintos** entre sí y distintos de `getEstadoColor()` en `uiMappings.ts`. Esto genera inconsistencia visual entre las vistas del portal y el sistema principal, y cualquier cambio de colores requiere editar 4 archivos.

**Recomendación**: Unificar. Usar `getEstadoColor()` de `uiMappings.ts` en las 3 páginas del portal, o agregar una variante allí si los estilos del portal son intencionalmente diferentes.

#### 2. ALTO — `helpers.ts` sigue teniendo 17 consumidores

Aunque `helpers.ts` fue reducido a un barrel mínimo, 17 archivos siguen importando desde él en vez de directamente desde `formatters.ts` y `uiMappings.ts`. El archivo intermedio agrega una capa de indirección innecesaria.

**Recomendación**: Migrar los 17 consumidores para importar directamente desde `formatters.ts` (`formatDate`) y `uiMappings.ts` (`getEstadoColor`, `getModoIcon`). Después, eliminar `helpers.ts`.

#### 3. ALTO — `as any` residuales en código de producción (6 ocurrencias)

- `PortalCotizacionDetalle.tsx`: 4× `(cot as any).comentario_cliente` — el campo existe en la BD pero no en el tipo `CotizacionRow`.
- `PortalDashboard.tsx`: 2× `ESTADOS_EMBARQUE.indexOf(a[0] as any)` — cast innecesario.
- `useEventosEmbarque.ts`: `tipo as any` — enum no tipado.
- `useEmbarqueMutations.ts`: `tipoEvento as any` — mismo problema de enum.

**Recomendación**: Agregar `comentario_cliente` a `CotizacionRow` (si existe en la BD). Para los `indexOf`, usar un type assertion más preciso. Para los enums de eventos, derivar el tipo del esquema.

#### 4. MEDIO — `format(parseISO(...))` inline en portal (7 llamadas)

`PortalDashboard.tsx` y `PortalEmbarqueDetalle.tsx` usan `format(parseISO(date), ...)` directamente en vez de `formatDate`. Algunos usan locale `es` con formatos especiales (`"dd MMM"`, `"dd 'de' MMMM"`).

**Recomendación**: Extender `formatDate` en `formatters.ts` para aceptar un parámetro `locale` opcional, y migrar las llamadas inline.

#### 5. MEDIO — `barColors` en `PortalDashboard.tsx` duplica colores de estado

Líneas 156-165 definen un mapa `barColors` con colores de barra por estado que son redundantes con `estadoConfig.ts` y `uiMappings.ts`.

**Recomendación**: Agregar un mapa de colores de barra a `uiMappings.ts` o `estadoConfig.ts`.

#### 6. MEDIO — `ESTADO_TIMELINE` sigue con consumidores activos

Aunque fue marcado como `@deprecated`, `useEmbarqueDetalleActions.ts` y el test `embarqueConstants.test.ts` lo usan. La migración quedó incompleta.

**Recomendación**: Reemplazar por `ESTADOS_EMBARQUE` en los 2 consumidores y eliminar el alias deprecated.

#### 7. MEDIO — Admin pages hacen queries directas a Supabase

`AdminDashboard.tsx`, `AdminUsuarios.tsx` y `AdminOrganizaciones.tsx` llaman `supabase.from(...)` directamente en la página en vez de usar hooks dedicados. Esto rompe la convención del resto de la app.

**Recomendación**: Extraer estas queries a `useAdminData.ts` o hooks similares, y registrar sus keys en `queryKeys.admin`.

#### 8. BAJO — Backward-compat wrappers en `useEmbarquesListData.ts`

`useEmbarquesLiquidacion` y `useEmbarquesDocsStatus` son wrappers de backward-compat sobre `useEmbarquesListExtras`. Solo `Embarques.tsx` los usa.

**Recomendación**: Migrar `Embarques.tsx` a usar `useEmbarquesListExtras` directamente y eliminar los wrappers.

#### 9. BAJO — `useEmbarqueUtils.ts` es solo tipos + re-export

El archivo solo define type aliases y re-exporta `calcularEstadoEmbarque`. Podría eliminarse moviendo los tipos a `useEmbarques.ts` o a un archivo `types/embarque.ts`.

#### 10. BAJO — Test de `helpers.ts` prueba funciones que ya no son canónicas ahí

`src/lib/__tests__/helpers.test.ts` testea `formatDate`, `getEstadoColor` y `getModoIcon` importándolos desde `helpers.ts`, pero las funciones canónicas están en `formatters.ts` y `uiMappings.ts`.

---

### Plan de acción recomendado

| Paso | Archivos afectados | Esfuerzo |
|------|-------------------|----------|
| 1. Eliminar `estadoColor` duplicados del portal, usar `getEstadoColor` | 3 archivos portal + `uiMappings.ts` | Bajo |
| 2. Migrar 17 consumidores de `helpers.ts` → imports directos, eliminar `helpers.ts` | 17 archivos + `helpers.ts` + test | Medio |
| 3. Eliminar `as any` residuales (agregar campo a tipo, tipar enums) | 4 archivos | Bajo |
| 4. Extender `formatDate` con locale y migrar `format(parseISO(...))` inline | `formatters.ts` + 2 archivos portal | Bajo |
| 5. Mover `barColors` a `uiMappings.ts` | `PortalDashboard.tsx` + `uiMappings.ts` | Bajo |
| 6. Completar migración de `ESTADO_TIMELINE` → `ESTADOS_EMBARQUE` | 2 archivos + `embarqueConstants.ts` | Bajo |
| 7. Extraer queries de admin a hooks dedicados | 3 archivos admin + nuevo hook | Medio |
| 8. Eliminar wrappers backward-compat en `useEmbarquesListData.ts` | 2 archivos | Bajo |
| 9. Consolidar `useEmbarqueUtils.ts` | 2 archivos | Bajo |
| 10. Mover test de helpers al módulo correcto | 1 archivo test | Bajo |

### Resumen

La arquitectura mejoró significativamente con la auditoría anterior. Los problemas restantes son: **consistencia incompleta** (mapas de color duplicados, `helpers.ts` aún como intermediario, `ESTADO_TIMELINE` deprecated pero activo) y **deuda técnica menor** (6 `as any`, queries inline en admin, wrappers de backward-compat). Ninguno es un blocker, pero resolverlos completa la limpieza iniciada en v8.2.0.

