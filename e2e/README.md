# E2E — Playwright

Smoke tests de los flujos críticos de Libre Carga, pensados como **gate de
go-live** y regresión semanal. No corren en `bun test` ni en CI por defecto.

## Quickstart (3 pasos)

```bash
# 1) Plantilla de variables → rellenar SÓLO los mínimos (BASE_URL + admin).
cp .env.e2e.example .env.e2e
$EDITOR .env.e2e

# 2) Validar qué está listo y qué se saltará (opcional pero recomendado).
bun run e2e:check

# 3) Instalar Chromium (una vez) y correr.
bun run e2e:install
bun run e2e
```

> ⚠️ `.env.e2e` contiene credenciales — NO lo commitees. Si no aparece en tu
> `.gitignore`, agrégalo (`echo .env.e2e >> .gitignore`).

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

> ⚠️ **Nunca** uses credenciales productivas. Provisiona un tenant de staging
> con datos seed determinísticos. Los specs 09–12 **mutan** datos reales y
> hacen cleanup best-effort; revisar el tenant tras correr.

## Secrets requeridos en GitHub Actions (CI)

El workflow `.github/workflows/e2e.yml` expone estas variables desde
`secrets.*`. Si un secret está vacío, el spec correspondiente skipea (a menos
que actives `strict_fixtures=1` en el dispatch):

| Secret | Spec(s) que habilita |
|---|---|
| `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD` | Todos (obligatorios) |
| `E2E_PORTAL_EMAIL`, `E2E_PORTAL_PASSWORD` | 05, 18 |
| `E2E_CROSS_ORG_EMBARQUE_ID`, `E2E_CROSS_ORG_FACTURA_ID`, `E2E_CROSS_ORG_COTIZACION_ID` | 06 (sin ellos degrada a UUID dummy) |
| `E2E_HAS_SEED` | 07 |
| `E2E_FISCAL`, `E2E_PROFORMA_NUMERO` | 08, 25 (requieren FacturApi sandbox) |
| `E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID`, `E2E_ADMIN_ORG` | 09 |
| `E2E_HAS_AUDIT_DATA` | 10 |
| `E2E_COTIZACION_ACEPTADA_ID` | 11 |
| `E2E_PROVEEDOR_ID`, `E2E_EMBARQUE_PARA_CXP_ID` | 12 |
| `E2E_MT_A_*`, `E2E_MT_B_*` | 26 (job `multi-tenant`) |
| `E2E_PROVISION_SECRET` | Job `provision-users` y `multi-tenant` |

## Provisionar usuarios E2E

Antes de la primera corrida (o cuando necesites resetear el password) ejecuta:

```bash
bun run e2e:provision
```

Esto invoca la edge function `e2e-provision-users`, que con `service_role`:

- Crea (o resetea el password de) `E2E_EMAIL` y le asigna rol `admin` +
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

Es idempotente: se puede correr N veces sin duplicar. En CI, agrégalo como
paso previo al matrix de Playwright (`bun run e2e:provision`).

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

Estos specs son **smoke**: validan que la app navega sin crashear y los
componentes clave montan. Cuando se estabilicen los selectores se pueden
profundizar a flujos transaccionales (crear embarque, emitir factura, etc.).

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
