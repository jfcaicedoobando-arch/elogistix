# E2E — Playwright

Smoke tests de los 5 flujos críticos de Libre Carga, pensados como **gate de
go-live** y regresión semanal. No corren en `npm test` ni en CI por defecto.

## Setup local (una sola vez)

```bash
npm i -D @playwright/test
npx playwright install chromium
```

## Variables de entorno

Crear `.env.e2e` (no commitear) o exportarlas en tu shell:

```bash
E2E_BASE_URL=http://localhost:8080            # o https://staging.tuapp.lovable.app
E2E_EMAIL=admin-staging@librecarga.test       # cuenta interna con acceso completo
E2E_PASSWORD=********
E2E_PORTAL_EMAIL=cliente-staging@empresa.test # cuenta de portal cliente
E2E_PORTAL_PASSWORD=********
```

> ⚠️ **Nunca** uses credenciales productivas. Provisiona un tenant de staging
> con datos seed determinísticos. Los specs asumen que existe al menos un
> cliente, un embarque y una factura previos.

## Correr

```bash
# Headless, los 5 specs
npx playwright test

# Con UI interactiva
npx playwright test --ui

# Sólo uno
npx playwright test 01-login
```

Resultados HTML quedan en `playwright-report/`.

## Especificaciones

| # | Spec | Cubre |
|---|------|-------|
| 01 | `01-login.spec.ts` | Login con credenciales válidas → dashboard interno. |
| 02 | `02-embarque.spec.ts` | Listado de embarques carga, abre detalle. |
| 03 | `03-factura.spec.ts` | Listado de facturación carga, tabs principales visibles. |
| 04 | `04-conciliacion.spec.ts` | Vista de conciliación / proformas con datos. |
| 05 | `05-portal.spec.ts` | Login portal cliente → dashboard portal. |

Estos specs son **smoke**: validan que la app navega sin crashear y los
componentes clave montan. Cuando se estabilicen los selectores se pueden
profundizar a flujos transaccionales (crear embarque, emitir factura, etc.).

## Convenciones

- Usar `data-testid="..."` para anclar elementos cuando el texto sea volátil.
- Preferir `page.getByRole(...)` o `getByLabel(...)` sobre selectores CSS.
- No depender de IDs autogenerados (UUID, timestamps).
- Cada spec hace login independiente vía fixture; no compartir estado.
