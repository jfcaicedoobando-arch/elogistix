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
```

> ⚠️ **Nunca** uses credenciales productivas. Provisiona un tenant de staging
> con datos seed determinísticos. Los specs 09–12 **mutan** datos reales y
> hacen cleanup best-effort; revisar el tenant tras correr.

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
| 06 | `06-security-cross-org.spec.ts` | Bloqueo de acceso cross-org vía URL directa (UI guard + REST sin leak). |
| 07 | `07-wizard-embarque-teclado.spec.ts` | Wizard Nuevo Embarque sólo con teclado (combobox cotización, badges HEREDADO, StepIndicator). Requiere `E2E_HAS_SEED=1`. |
| 08 | `08-flujo-fiscal.spec.ts` | Happy path: proforma → factura → timbrado → pago PPD → REP. Requiere `E2E_FISCAL=1` + FacturApi sandbox. |
| 09 | `09-cierre-embarque.spec.ts` | Checklist bloquea el cierre + tooltip; bypass admin_org opcional. **Muta**: reabre el embarque en cleanup. |
| 10 | `10-auditoria-bulk.spec.ts` | Selección múltiple de hallazgos + marcar revisados; snooze rechaza >30 días. **Muta**: deja revisiones marcadas `E2E_TEST`. |
| 11 | `11-cotizacion-a-embarque.spec.ts` | Cotización aceptada → `crear_embarque_borrador_desde_cotizacion` → expediente real. **Muta**: borra el embarque borrador en cleanup. |
| 12 | `12-cxp-factura-pago.spec.ts` | Captura factura proveedor (asigna folio `FP-XXXXXX`) + registra pago. **Muta**: borra pago y factura en cleanup. |

Estos specs son **smoke**: validan que la app navega sin crashear y los
componentes clave montan. Cuando se estabilicen los selectores se pueden
profundizar a flujos transaccionales (crear embarque, emitir factura, etc.).

## Convenciones

- Usar `data-testid="..."` para anclar elementos cuando el texto sea volátil.
- Preferir `page.getByRole(...)` o `getByLabel(...)` sobre selectores CSS.
- No depender de IDs autogenerados (UUID, timestamps).
- Cada spec hace login independiente vía fixture; no compartir estado.
