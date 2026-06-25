# Plan: Integración Libre Carga ↔ FacturApi (multi-tenant)

## Analogía rápida

Hoy ya tenemos el "cableado eléctrico" (las edge functions `facturapi-emitir`, `-cancelar`, `-rep`) pero está conectado a **un solo enchufe** (`FACTURAPI_KEY` global). Lo que vamos a hacer es: poner un **tablero de breakers por organización**, conectar primero a la "corriente de prueba" (sandbox) y, cuando todo prenda, mover el switch a "corriente real" (producción).

## Alcance confirmado

- ✅ Timbrado CFDI 4.0 (ingreso) desde proformas y facturas manuales.
- ✅ Complemento de Pagos (REP) al registrar pagos.
- ✅ Cancelación CFDI con motivos SAT 01–04 (incluye sustitución).
- ✅ Webhooks de FacturApi (sincronización de estado).
- ✅ Multi-tenant real: **una cuenta FacturApi por organización**.
- ✅ Sandbox primero → producción después.

## Lo que YA existe en el código (no se vuelve a escribir)

- Edge functions: `facturapi-emitir`, `facturapi-cancelar`, `facturapi-emitir-rep`, `facturapi-cancelar-rep`.
- Helpers: `helpers.ts` con `buildFacturapiPayload`, `validateContext`, `basicAuthHeader`.
- UI: `DialogTimbrarFactura`, `DialogCancelarFactura`, hooks `useTimbrarFactura`, `useCancelarFactura`, `useCrearFacturaManual`.
- Servicios cliente: `services/facturapi.ts`, `services/repFacturapi.ts`.
- Tests estructurales en `index_test.ts` (auth, orden, persistSession=false).

Lo que falta es: **credenciales por org, configuración de emisor (CSD), webhook receiver, panel de admin para que cada org pegue su llave, y el ambiente sandbox/prod**.

---

## Fase 0 — Decisiones previas (sin código)

1. Confirmar con FacturApi el modelo de cuentas:
  - Opción A: una cuenta FacturApi "padre" de Libre Carga + sub-organizaciones (FacturApi soporta esto vía su API de Organizations).
  - Opción B: cada tenant abre su propia cuenta FacturApi y nos pasa su `FACTURAPI_KEY`.
  - **Recomendación:** Opción A. Libre Carga administra el billing y onboarding, cada org es una "Organization" dentro de FacturApi. Más control, mejor UX, una sola integración de webhook.
2. Definir quién sube el CSD (certificado .cer/.key + contraseña):
  - **Recomendación:** lo sube el `admin_org` en `/configuracion` mediante un formulario que llama a la API de FacturApi `POST /organizations/:id/certificate` (los archivos van directo a FacturApi, **nunca tocan nuestra DB**).

---

## Fase 1 — Esquema de datos (multi-tenant)

Nueva tabla `facturapi_credenciales`:


| Columna                       | Tipo                  | Notas                                              |
| ----------------------------- | --------------------- | -------------------------------------------------- |
| `organization_id`             | uuid PK FK            | 1 fila por org                                     |
| `facturapi_org_id`            | text                  | ID que devuelve FacturApi al crear la Organization |
| `ambiente`                    | enum `sandbox`/`live` | controla qué API key usar                          |
| `api_key_sandbox_secret_name` | text                  | nombre del secret en Supabase Vault (no la key)    |
| `api_key_live_secret_name`    | text                  | nombre del secret en Supabase Vault                |
| `certificado_cargado`         | boolean               | flag visual, el CSD vive en FacturApi              |
| `certificado_vence_at`        | date                  | para alertar 30 días antes                         |
| `webhook_secret`              | text                  | firma HMAC del webhook                             |
| `last_test_timbre_at`         | timestamptz           | última prueba sandbox OK                           |


RLS: sólo `admin_org`/`super_admin` de la organización pueden ver/editar. Lectura desde edge functions vía `service_role`.

**Importante:** las API keys reales NO se guardan en esta tabla. Se guardan como secrets de Supabase con nombre `FACTURAPI_KEY_<ORG_ID>_SANDBOX` / `_LIVE`. La tabla sólo guarda el **nombre del secret**, no el valor.

---

## Fase 2 — Refactor de edge functions a multi-tenant

Cambio quirúrgico en `facturapi-emitir`, `facturapi-cancelar`, `facturapi-emitir-rep`, `facturapi-cancelar-rep`:

1. Después del auth check, leer `factura.organization_id`.
2. Cargar fila de `facturapi_credenciales` para esa org.
3. Resolver qué secret usar: `ambiente='sandbox'` → `api_key_sandbox_secret_name`; `ambiente='live'` → `api_key_live_secret_name`.
4. Leer el secret correspondiente con `Deno.env.get(<nombre>)`.
5. Si no hay credenciales configuradas → 412 `org_facturapi_not_configured` con mensaje claro.

Helper compartido nuevo: `supabase/functions/_shared/facturapiAuth.ts` con función `resolveFacturapiKey(orgId)` para no repetir lógica en las 4 funciones.

---

## Fase 3 — UI de configuración en `/configuracion`

Nueva tab "Facturación electrónica" visible sólo para `admin_org`:

1. **Paso 1 — Crear organización en FacturApi** (botón): llama a nueva edge function `facturapi-org-provision` que:
  - Crea la Organization en FacturApi vía API.
  - Guarda `facturapi_org_id` en la tabla.
  - Guarda la API key devuelta en Supabase secret y registra el nombre.
2. **Paso 2 — Subir CSD**: formulario con `.cer`, `.key`, contraseña. Edge function `facturapi-org-certificado` hace `PUT` directo a FacturApi (los archivos pasan por la edge function como multipart, nunca se persisten en nuestro storage).
3. **Paso 3 — Datos fiscales del emisor**: RFC, razón social, régimen fiscal, CP. Se mandan a FacturApi `PUT /organizations/:id/legal`.
4. **Paso 4 — Probar timbrado sandbox** (botón): genera una factura ficticia, la timbra contra FacturApi sandbox, y si responde 200 marca `last_test_timbre_at`.
5. **Paso 5 — Cambiar a producción** (toggle): sólo se habilita si pasó el paso 4. Muestra confirmación tipo "ELIMINAR" pidiendo escribir `PRODUCCION` para evitar accidentes.

---

## Fase 4 — Webhooks de FacturApi

1. Nueva edge function `facturapi-webhook` (`verify_jwt = false`, ruta pública).
2. FacturApi firma cada webhook con HMAC. Verificar firma con `webhook_secret` de la org.
3. Eventos a manejar:
  - `invoice.created` → confirmar UUID y URLs PDF/XML en `facturas`.
  - `invoice.canceled` → actualizar `estado = 'cancelada'` y guardar `acuse_cancelacion`.
  - `invoice.cancellation_failed` → alertar al usuario.
4. Idempotencia: tabla `idempotency_keys` ya existe; usar `event_id` de FacturApi como clave.
5. Config webhook URL en cada Organization de FacturApi durante Fase 3, paso 1.

---

## Fase 5 — Tests y validación

1. **Tests unitarios** (Deno) en cada edge function:
  - `resolveFacturapiKey` devuelve la key correcta según ambiente.
  - Falla limpia (412) cuando no hay credenciales.
  - Webhook rechaza firmas inválidas.
2. **Test manual sandbox** con una org de prueba:
  - Timbrar 1 factura USD, 1 MXN, 1 con IVA cero.
  - Cancelar con motivo 02.
  - Timbrar REP y validar parcialidad.
  - Disparar webhook desde FacturApi dashboard.
3. **Test arquitectónico**: agregar `src/__tests__/architecture/facturapi-multi-tenant.test.ts` que verifica que ninguna edge function lea `FACTURAPI_KEY` global directamente (todas deben pasar por el helper).

---

## Fase 6 — Go-live por organización

1. Para cada cliente real:
  - Admin de la org sube CSD productivo en `/configuracion`.
  - Hace prueba sandbox exitosa.
  - Cambia toggle a `live`.
  - Primera factura productiva monitoreada manualmente.
2. Documentar en `docs/facturapi-onboarding.md` el procedimiento paso a paso.

---

## Detalles técnicos clave

- **Secrets dinámicos**: Supabase no permite listar secrets por patrón desde edge functions; mantener la convención `FACTURAPI_KEY_<ORG_ID>_<AMBIENTE>` y leer por nombre exacto que viene de la tabla.
- **Rate limiting de FacturApi**: 100 req/min por organización. Agregar retry exponencial en `_shared/facturapiAuth.ts`.
- **Logs**: cada llamada a FacturApi se registra en `app_logs` con `org_id`, `factura_id`, `latencia_ms`, `http_status`. **Nunca loggear** la API key.
- **Bypass de cierre** (memoria existente): no aplica aquí; las facturas timbradas siguen siendo inmutables por el trigger `factura_inmutable`.

## Riesgos y mitigaciones


| Riesgo                                          | Mitigación                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Org sube CSD inválido                           | Validar con `POST /organizations/:id/certificate` que devuelve error claro; mostrarlo en UI. |
| API key se filtra en logs                       | Helper centralizado nunca recibe la key como argumento visible; sólo la lee de `Deno.env`.   |
| Tenant cambia accidentalmente de sandbox a live | Doble confirmación tipo "ELIMINAR" + sólo después de prueba exitosa.                         |
| Webhook llega 2 veces                           | Idempotencia por `event_id`.                                                                 |
| CSD vence                                       | Cron diario que avisa 30/15/7/1 días antes en `notificaciones_internas`.                     |


## Versionado y changelog

- Bump a `13.136.0` (cambio mayor de feature).
- Entrada en `CHANGELOG.md` raíz por cada fase entregada.

## Lo que NO incluye este plan

- Facturación global / a extranjeros con RFC genérico (XEXX010101000) — ya soportado por código existente.
- Carta Porte 3.1 — fuera de alcance, sería plan aparte.
- Migración histórica de las 12 facturas USD con TC=1 — sigue bloqueada por `factura_inmutable`, se trata aparte.

## Siguiente paso

Si apruebas, arranco con **Fase 1 (migración de `facturapi_credenciales`)** y **Fase 2 (helper compartido + refactor de las 4 edge functions)** en un solo bump de versión. No, Solo quiero que guardes el plan.