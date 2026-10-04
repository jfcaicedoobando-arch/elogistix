# E2E — Playwright

> Revisado el 2026-10-03. La suite visual aislada sí se ejecutó; flujos conectados requieren fixtures explícitas.
> Provisioning, seed y varios specs crean/modifican registros. Sólo staging autorizado.

Pruebas de navegador de los flujos críticos de Libre Carga, pensados como **gate de
go-live** y regresión bajo demanda. No corren en `bun test` ni en CI por defecto.

## Quickstart (3 pasos)

```bash
# 1) Copiar plantilla y configurar destino/credenciales de PRUEBA.
cp .env.e2e.example .env.e2e
$EDITOR .env.e2e

# 2) Validar qué está listo y qué se saltará (opcional pero recomendado).
bun run e2e:check

# 3) Instalar Chromium (una vez) y correr.
bun run e2e:install
bun run e2e
```

> `.env.e2e` contiene credenciales y está ignorado: NO lo commitees.
> Los ejemplos de shell son Bash; en PowerShell usa variables `$env:...`.

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `bun run e2e:check` | Valida las variables mínimas y reporta qué specs se saltarán. |
| `bun run e2e:install` | `playwright install --with-deps chromium` (una vez por máquina). |
| `bun run e2e` | Corre toda la suite contra `E2E_BASE_URL` (default `http://localhost:8080`). |
| `bun run e2e:local` | Fuerza `E2E_BASE_URL=http://localhost:8080` (arranca `vite dev` automático). |
| `bun run e2e:staging` | Alias de `e2e` — apunta al `E2E_BASE_URL` de tu `.env.e2e`. |
| `bun run e2e:ui` | Modo interactivo (Playwright UI). |
| `bun run e2e:headed` | Corrida con navegador visible. |
| `bun run e2e:report` | Abre el reporte HTML de la última corrida. |
| `bun run e2e:provision` | Provisiona/reset admin + portal en staging (edge function). |
| `bun run e2e:provision-multi-tenant` | Provisiona orgs A/B para el spec 26. |
| `bun run e2e:seed` | Siembra idempotente de catálogos demo (navieras, agentes, rutas, tarifas, productos, cuentas bancarias, cliente y proveedor). |

### Semilla de catálogos (`e2e:seed`)

Requiere `DATABASE_URL` (o `SUPABASE_DB_URL`) y `E2E_ORG_ID` en el entorno o en
`.env.e2e`. Usa UPSERT por clave natural, así que puede correrse tantas veces
como haga falta sin duplicar datos:

```bash
E2E_ORG_ID=<uuid-org-demo> bun run e2e:seed
```

Los datos viven en `src/lib/e2e/seedDemoData.ts` (módulo puro, con test unitario).

## Setup local (una sola vez)

```bash
bun run e2e:install    # descarga Chromium + libs del sistema
```



## Variables de entorno

Crear `.env.e2e` (no commitear) o exportarlas en tu shell:

```bash
E2E_BASE_URL=http://localhost:8080            # o https://staging.tuapp.lovable.app
E2E_EMAIL=admin-staging@librecarga.test       # cuenta interna con acceso completo
E2E_PASSWORD=********
E2E_PORTAL_EMAIL=cliente-staging@empresa.test # cuenta de portal cliente
E2E_PORTAL_PASSWORD=********

# Specs avanzados (opcionales — el spec se salta si falta su flag)
E2E_HAS_SEED=1                                # 07 wizard teclado
E2E_FISCAL=1                                  # 08 happy path fiscal sandbox
E2E_PROFORMA_NUMERO=PRO-2026-XXXX             # 08
E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID=<uuid>   # 09 cierre embarque
E2E_ADMIN_ORG=1                               # 09 probar bypass admin_org
E2E_HAS_AUDIT_DATA=1                          # 10 auditoría bulk
E2E_COTIZACION_ACEPTADA_ID=<uuid>             # 11 cotización → embarque
E2E_PROVEEDOR_ID=<uuid>                       # 12 CXP
E2E_EMBARQUE_PARA_CXP_ID=<uuid>               # 12 CXP

# Cross-org (06) — opcionales, IDs de OTRA organización
E2E_CROSS_ORG_EMBARQUE_ID=<uuid>
E2E_CROSS_ORG_FACTURA_ID=<uuid>
E2E_CROSS_ORG_COTIZACION_ID=<uuid>

# Multi-tenant (26) — orgs A/B con datos trazadores. Requiere corrida previa de
# `bun run e2e:provision-multi-tenant`. Si estas 4 faltan, el job CI se salta.
E2E_MT_A_EMAIL=admin-a-staging@librecarga.test
E2E_MT_A_PASSWORD=********
E2E_MT_B_EMAIL=admin-b-staging@librecarga.test
E2E_MT_B_PASSWORD=********

# STRICT (opcional): si vale "1", `requireFixture()` promueve skips por
# fixture ausente a fallo. Útil en CI dispatch cuando quieres garantía dura.
E2E_STRICT_FIXTURES=
```

> **Nunca** uses Live fiscal ni cuentas operativas reales. Provisiona un tenant de staging
> con datos seed determinísticos. Los specs 08–12, 25, 28 y 30 escriben y
> están serializados. 08/25 conservan evidencia fiscal Sandbox; requieren documentos
> nuevos por corrida. 11 revierte sólo su embarque mediante el RPC canónico.

## Secrets requeridos en GitHub Actions (CI)

El workflow `.github/workflows/e2e.yml` sólo corre por dispatch manual y usa
el environment `e2e-staging`. Si faltan credenciales CORE (interno, portal,
provisioning y Supabase), **falla el guard**, no produce verde vacío.
`required_flows` selecciona los mutadores que se ejecutarán (default `08,11,12,25`).
Su gate exige que TODOS sus pasos pasen: un skip o fallo no se satisface con tests
verdes de otro flujo. `strict_fixtures=1` exige además fixtures opcionales de los
otros lanes; el default `0` conserva sus skips explícitos. Multi-tenant sigue opcional.

| Secret | Spec(s) que habilita |
|---|---|
| `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD` | Todos (obligatorios) |
| `E2E_PORTAL_EMAIL`, `E2E_PORTAL_PASSWORD` | 05, 18 |
| `E2E_CROSS_ORG_EMBARQUE_ID`, `E2E_CROSS_ORG_FACTURA_ID`, `E2E_CROSS_ORG_COTIZACION_ID` | 06 (sin ellos degrada a UUID dummy) |
| `E2E_HAS_SEED` | 07 |
| `E2E_FISCAL`, `E2E_PROFORMA_NUMERO` | 08 (proforma mock nueva, monomoneda, aceptada; cliente fiscal válido; Sandbox comprobado) |
| `E2E_FISCAL`, `E2E_SUSTITUCION_FACTURA_UUID` | 25 (ID interno de factura Emitida mock propia; no el UUID SAT) |
| `E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID`, `E2E_ADMIN_ORG` | 09 |
| `E2E_HAS_AUDIT_DATA` | 10 |
| `E2E_COTIZACION_ACEPTADA_ID` | 11 |
| `E2E_PROVEEDOR_ID`, `E2E_EMBARQUE_PARA_CXP_ID`, `E2E_CONCEPTO_CXP_ID`, `E2E_CATEGORIA_CXP_ID` | 12 (costo propio MXN >=1000 y embarque confirmado; proveedor activo) |
| `E2E_FACTURA_BORRADOR_ID` | 30 (borrador propio sin UUID; PAC interceptado, no emisión real) |
| `E2E_EMBARQUE_EDITAR_ID` | 32 (marítimo propio completo con naviera/agente IDs, BL master/house, ETD/ETA; sólo lectura) |
| `E2E_MT_A_*`, `E2E_MT_B_*` | 26 (job `multi-tenant`) |
| `E2E_PROVISION_SECRET` | Job `provision-users` y `multi-tenant` |

## PDF y regresión visual aislados

`PDF and visual diagnostics (on demand)` corre únicamente por dispatch. No pide
credenciales, no timbra ni escribe en Supabase. No agrega renderer real, browsers
o coverage al CI habitual de 5 shards / 2 workers.

- `bun run test:pdf`: renderer real sin el alias/stub de la suite rápida.
  Requiere Poppler (`pdfinfo`, `pdftotext`); `PDF_PYTHON` permite usar Python con
  pypdf en local. Genera cotización, proforma, proforma de 60 líneas y tesorería
  con contenido/importes comprobados en `reports/pdf-smoke/`. Revisión renderizada
  adicional; aprobar texto no certifica ausencia de recortes visuales.
- `bun run test:visual`: componentes compartidos reales en un entry local sin
  App/auth/Sentry. Baselines revisados de shell/tabla/modal, 1280×720 y 691×763,
  claro/oscuro, Chromium de Playwright en Windows. No cubre permisos ni cada módulo.
  Ocho PNG versionados en `e2e/visual/baselines/`; no actualizar automáticamente
  en CI. Un cambio aprobado se regenera con `--update-snapshots`, se revisa y se
  vuelve a ejecutar SIN ese flag antes de guardar el baseline.
- `node node_modules/typescript/bin/tsc -p tsconfig.test-tooling.json` valida E2E,
  fixtures, harness visual y smoke PDF, antes fuera del typecheck del frontend.

Las pruebas financieras SQL se ejecutan sólo en el Postgres efímero de Actions:
un único manifiesto bloqueante incluye las 13 suites recuperadas del antiguo radar.
El cobro atómico se verifica por efectos (retry/conflicto/rollback) y por dos
conexiones realmente contendiendo. Ninguna de estas pruebas envía CFDI al PAC.

## Provisionar usuarios E2E

Antes de la primera corrida (o cuando necesites resetear el password) ejecuta:

```bash
bun run e2e:provision
```

Esto invoca la edge function `e2e-provision-users` y puede crear/resetear usuarios:

- Crea (o resetea el password de) `E2E_EMAIL` y configura su rol interno +
  membresía en `organization_members` de `E2E_ORG_ID` (o la primera org).
- Crea (o resetea el password de) `E2E_PORTAL_EMAIL`, le asigna rol `cliente`
  y lo vincula vía `client_users` a `E2E_CLIENTE_ID` (o al primer cliente de
  la organización).

Requiere en `.env.e2e`:

```bash
E2E_PROVISION_SECRET=<mismo valor que el runtime secret del proyecto>
# opcionales:
E2E_ORG_ID=<uuid>
E2E_CLIENTE_ID=<uuid>
```

El workflow manual ya lo ejecuta antes de los jobs de navegador.
Repetir puede resetear usuarios; idempotencia no significa ausencia de efectos.

## Correr

```bash
# Toda la suite (usa E2E_BASE_URL del .env.e2e)
bun run e2e

# Modo interactivo
bun run e2e:ui

# Sólo un spec
bunx playwright test 01-login

# Forzar contra localhost aunque .env.e2e apunte a staging
bun run e2e:local
```

Resultados HTML quedan en `playwright-report/` (ábrelos con `bun run e2e:report`).


## Especificaciones

| # | Spec | Cubre |
|---|------|-------|
| 01 | `01-login.spec.ts` | Login con credenciales válidas → dashboard interno. |
| 02 | `02-embarque.spec.ts` | Listado de embarques carga, abre detalle. |
| 03 | `03-factura.spec.ts` | Listado de facturación carga, tabs principales visibles. |
| 04 | `04-conciliacion.spec.ts` | Vista de conciliación / proformas con datos. |
| 05 | `05-portal.spec.ts` | Login portal cliente → dashboard portal. |
| 06 | `06-security-cross-org.spec.ts` | Bloqueo de acceso cross-org vía URL directa (UI guard + REST sin leak). |
| 07 | `07-wizard-embarque-teclado.spec.ts` | Wizard Nuevo Embarque sólo con teclado (combobox cotización, badges HEREDADO, StepIndicator). Requiere `E2E_HAS_SEED=1`. |
| 08 | `08-flujo-fiscal.spec.ts` | Happy path: proforma → factura → timbrado → pago PPD → REP. Requiere `E2E_FISCAL=1` + FacturApi sandbox. |
| 09 | `09-cierre-embarque.spec.ts` | Checklist bloquea el cierre + tooltip; bypass admin_org opcional. **Muta**: reabre el embarque en cleanup. |
| 10 | `10-auditoria-bulk.spec.ts` | Selección múltiple de hallazgos + marcar revisados; snooze rechaza >30 días. **Muta**: deja revisiones marcadas `E2E_TEST`. |
| 11 | `11-cotizacion-a-embarque.spec.ts` | Cotización aceptada → `crear_embarque_borrador_desde_cotizacion` → expediente real. **Muta**: borra el embarque borrador en cleanup. |
| 12 | `12-cxp-factura-pago.spec.ts` | Captura factura proveedor (asigna folio `FP-XXXXXX`) + registra pago. **Muta**: borra pago y factura en cleanup. |
| 21 | `21-embarque-detalle-tabs.spec.ts` | Detalle de embarque: tabs Resumen/Tracking/Documentos montan; sin "ETA vencida" tras arribo (regresión 13.300.16). |
| 22 | `22-modal-enviar-documento.spec.ts` | Modal Enviar cotización: chips en Para/CC + chip bloqueado del usuario (rediseño 13.300.17). |
| 23 | `23-por-cobrar-aging.spec.ts` | Bandeja Por cobrar: la columna "Vence en" no está clampada a "hoy" (regresión 13.300.18). |
| 24 | `24-auditoria-cache-invalidation.spec.ts` | /auditoria dispara `auditoria_embarques_org` al montar y al pulsar Recalcular (13.300.20). |

La suite mezcla navegación y pruebas transaccionales. Revisar el spec real
antes de correrlo: la tabla de ejemplos no sustituye el inventario.
Mutators se ejecutan en serie; hay guards que exigen tests realmente ejecutados.

## Convenciones

- Importar `{ expect, test }` desde `../fixtures/testBase` (NO desde
  `@playwright/test`). `testBase` compone la captura de errores de página
  con el fixture `sessionIsolation`, que limpia cookies + `localStorage` /
  `sessionStorage` después de cada test y avisa si el `storageState`
  arrastra cookies de dominios ajenos al `baseURL`.
- Para mezclar roles dentro de un mismo test (admin ↔ portal cliente) usar
  `switchUser(page, creds)` de `fixtures/auth.ts` — hace `clearCookies` +
  purga de storage antes del `loginAs`, evitando que Supabase reutilice el
  token del rol anterior.
- Usar `data-testid="..."` para anclar elementos cuando el texto sea volátil.
- Preferir `page.getByRole(...)` o `getByLabel(...)` sobre selectores CSS.
- No depender de IDs autogenerados (UUID, timestamps).
- Cada spec hace login independiente vía fixture; no compartir estado.
