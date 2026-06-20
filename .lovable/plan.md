# Paso 9 — Mover `src/services/*` y `src/hooks/*` shadow a sus features

Continuamos la auditoría adelgazando los cajones layer-first (`src/services/`, `src/hooks/`) para empujarlos a `features/<dominio>/(services|hooks)/`. Lo transversal (sin dueño claro) se queda.

## Mapeo de servicios

| Origen                                  | Destino                                          | Notas |
| --------------------------------------- | ------------------------------------------------ | ----- |
| `src/services/bitacora/`                | `features/auditoria/services/bitacora/`          | Consumido por hooks de auditoría y `useBitacora`. |
| `src/services/notificaciones/`          | `features/notificaciones/services/` (feature nueva) o `features/admin/services/notificaciones/` si prefieres no abrir otra | El único consumidor es `useNotificacionesInternas`. |
| `src/services/organization/`            | `features/admin/services/organization/`          | Lo usa `OrganizationContext`. |
| `src/services/search/`                  | `features/search/services/` (feature nueva) o quedarse transversal | Lo usa `useGlobalSearch` y un hook del portal. |
| `src/services/storage/`                 | `features/embarques/services/storage/`           | Aunque lo importan varios features (portal, cotización, embarques), su dueño funcional son adjuntos de embarque. Alternativa: dejarlo transversal. |
| `src/services/tracking/`                | `features/embarques/services/tracking/`          | TrackingPublico es página pero el contenido es de embarques. |
| `src/services/usuario/`                 | `features/admin/services/usuario/`               | Lo consumen admin/users. |
| `src/services/observability/`           | **Se queda en `src/services/`** (transversal — logger, ErrorBoundary). |
| `src/services/{demoAccess,demoMode,unsubscribeService}.ts` | `features/{marketing,marketing,auth}/services/` | Cada uno tiene un consumidor claro. |

## Mapeo de hooks

| Origen                              | Destino                                       |
| ----------------------------------- | --------------------------------------------- |
| `src/hooks/layout/`                 | `src/components/layout/hooks/` o `features/_shared/` — transversal; **se queda**. |
| `src/hooks/sentry/`                 | `src/lib/observability/hooks/` — transversal. |
| `src/hooks/shared/useBitacora.ts`   | `features/auditoria/hooks/`                   |
| `src/hooks/shared/useGlobalSearch.ts` | `features/search/hooks/` (o donde aterrice search) |
| `src/hooks/shared/{useDebounce,useIsMobile,useListPageState,useOrgFilter,usePermissions,useRadixPointerEventsRescue}.ts` | Se quedan (utilidades UI transversales). |
| `src/hooks/usuario/`                | `features/admin/hooks/usuario/`               |
| `src/hooks/useIsDemoUser.ts`        | `features/marketing/hooks/`                   |
| `src/hooks/useNotificacionesInternas.ts` | `features/notificaciones/hooks/` o `features/admin/hooks/` |

## Mapeo de componentes (sólo los que claramente son de un feature)

| Origen                                  | Destino                                       |
| --------------------------------------- | --------------------------------------------- |
| `src/components/dashboard-ejecutivo/`   | `features/dashboardEjecutivo/components/`     |
| `src/components/tracking/`              | `features/embarques/components/tracking/`     |
| `src/components/usuario/`               | `features/admin/components/usuario/`          |

Los demás (`shared/`, `ui/`, `layout/`, `selects/`, `seo/`, `feedback/`, `empty/`) son transversales y permanecen.

## Trabajo concreto

1. `mv` por carpeta + crear features nuevas si hace falta (`notificaciones`, `search`).
2. Reescribir imports con `find … | xargs sed -i`.
3. Actualizar barrels (`features/<x>/services/index.ts`, `hooks/index.ts`) para reexportar.
4. Ajustar tests de arquitectura que referencien las rutas viejas (`unsubscribe-encapsulation.test.ts`, etc.).
5. Correr `bunx vitest run`.
6. Bumpear `APP_VERSION` → `13.82.0` y entrada en `CHANGELOG.md`.

## Preguntas antes de implementar

1. ¿Creo features nuevos para `notificaciones` y `search`, o los meto bajo `features/admin/` y `features/_shared/` respectivamente para no inflar el árbol?
2. `src/services/storage/` lo usan 3 features distintos. ¿Lo dejo en `src/services/storage/` como transversal, o lo muevo a `features/embarques/services/storage/` re-exportando?
3. ¿Hacemos los tres bloques (services + hooks + components) en un solo turno (≈40-50 archivos) o lo divido?
