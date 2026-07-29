## 0. Urgente: el build está roto (mi culpa, del turno anterior)

`src/constants/appVersion.ts` quedó **vacío** (0 bytes) al bumpear la versión, así que `APP_VERSION` ya no existe y tanto `vite.config.ts` como `src/lib/ui/errorReport.ts` fallan al compilar. Analogía: le borré la etiqueta al frasco y ahora la receta que la busca no encuentra nada.

Arreglo: recrear el archivo exportando `APP_VERSION = "13.334.0"` y volver a compilar. Es lo primero que haré al pasar a build mode.

---

## 1. ¿Qué falta del documento de auditoría?

Revisé el estado real en el código: **P-01 a P-10 están implementados**. Verificado:

| # | Estado en el repo |
|---|---|
| P-01 diagnóstico integridad | Ejecutado; sólo apareció `generar_expediente` duplicada (ya reconciliada) |
| P-02 `proveedores_listado` | No aplicaba: una sola sobrecarga |
| P-03 RLS tesorería | Políticas de lectura para `tesorero`/`contador` aplicadas |
| P-04 carrera del guard | `useAuthProfile` expone `profileLoading`; `AuthContext.loading = sessionLoading \|\| (!!user && profileLoading)` |
| P-05 toasts | `duration: 8000` + `id: err-<code>` (dedupe) |
| P-06 skeleton infinito | `LoadingState` con `timeoutMs`, `error`, `onRetry`, `errorLabel` |
| P-07 portal | CTA solicitar cotización, deep links, `PortalSinCliente`, estados vacíos |
| P-08 documentos | Sólo CSF obligatoria |
| P-09 usuarios admin | Banner persistente de fallo de correos |
| P-10 guardia migraciones | Regla `H7` en `audit-migrations.ts` + `scripts/db/integrity-guard.sql` |

Queda **un pendiente real de P-10**: `scripts/db/integrity-guard.sql` existe pero **nadie lo ejecuta en CI** — es una guía manual, no un gate.

---

## 2. ¿Hay tests para todo? No. Estos son los huecos

Con tests hoy: `LoadingState`, `appFeedback`, `useAuthProfile`, `AuthContext`, `solicitudes` (servicio del portal), `useNuevoClienteController` (regla CSF).

Sin tests:

1. `SolicitarCotizacionDialog` + `useSolicitarCotizacion` (sólo está probado el servicio).
2. `PortalSinCliente` y la rama "sin empresa vinculada" de `PortalLayout`.
3. Deep links: `isDeepLinkPermitido` en `LoginForm` no está exportado ni probado (aquí vive el riesgo de open-redirect).
4. `ProtectedRoute` no tiene test de que preserve `state={{ from: location }}`.
5. Banner de error de correos en `UsuariosInternosTab` (P-09).
6. P-03/P-10: no hay verificación automatizada de la RLS de tesorería ni del guard de integridad.

---

## 3. Plan de trabajo

**Paso 0 — Reparar build**
- Recrear `src/constants/appVersion.ts` con `APP_VERSION = "13.334.0"` y correr `bun run build:dev`.

**Paso 1 — Tests de las brechas del portal (P-07)**
- `useSolicitarCotizacion.test.tsx`: éxito invalida caché de cotizaciones y notifica; error propaga mensaje.
- `SolicitarCotizacionDialog.test.tsx`: valida campos obligatorios, envía payload correcto, cierra al éxito.
- `PortalSinCliente.test.tsx`: renderiza el mensaje y dispara `onSignOut`.
- `PortalLayout` (rama sin cliente): con `client_users` vacío muestra `PortalSinCliente` en lugar del `Outlet`.

**Paso 2 — Tests de navegación segura (P-04/P-07)**
- Extraer `isDeepLinkPermitido` a `src/features/auth/utils/deepLink.ts` (import en `LoginForm`) y cubrirlo: rechaza `//evil.com`, `/login`, cruces de área (cliente→`/cotizaciones`, interno→`/portal`); acepta `/portal/embarques?x=1` para cliente.
- Test de `ProtectedRoute`: sin sesión redirige a `/login` conservando `state.from`.

**Paso 3 — Test del banner de usuarios (P-09)**
- `UsuariosInternosTab`: cuando la resolución de correos falla, muestra el banner y el botón "Reintentar".

**Paso 4 — Cerrar P-10 en CI**
- Añadir script `audit:db-integrity` que ejecute las tres consultas de `integrity-guard.sql` contra la base y falle con exit ≠ 0 si hay funciones duplicadas, enums rotos o tablas con RLS sin políticas.
- Enchufarlo en `deploy-gate.yml` (y en `ci.yml` si hay credenciales disponibles); si no hay conexión en el runner, degradar a warning explícito en vez de falso verde.

**Paso 5 — Verificación y registro**
- `bunx vitest run` de los paquetes tocados + `bun run lint`, `audit:arch`, `knip`, `build:dev`.
- Actualizar `CHANGELOG.md` y bumpear `APP_VERSION` a `13.334.1`.

### Notas técnicas
- No se toca lógica de negocio: sólo se agregan pruebas, se extrae una función pura ya existente y se suma un gate de CI.
- Los nuevos tests usan los patrones ya establecidos (`createWrapper`, mocks thenable de Supabase) para no romper la limpieza global de RTL.
- El umbral de cobertura no se baja; estas pruebas lo suben.
