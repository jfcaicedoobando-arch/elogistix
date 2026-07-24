
# Plan: remediación auditoría E2E (t3-e2e-audit.md)

La auditoría identifica 3 clases de problemas: **(a) specs valiosos que nunca corren en CI** por falta de env/jobs, **(b) tests "verdes falsos"** que skippean silenciosamente o solo miden overflow/consola, y **(c) gaps de flujos fiscales/CxC/CxP** sin cobertura. La estrategia es arreglar primero lo que ya existe pero no ejecuta (bajo costo, alto valor), después endurecer los skips silenciosos, y por último añadir cobertura nueva.

## Ola 1 — Activar lo que ya existe (bajo costo, alto valor)

1. **Job `chromium-multi-tenant` en `.github/workflows/e2e.yml`**
   - Añadir job que corra `bun run e2e:provision-multi-tenant` antes y luego `playwright test --project=chromium-multi-tenant`.
   - Secrets necesarios: los mismos `E2E_*` + `E2E_CROSS_ORG_*` que ya usa 06 (validar que existen en repo settings; si no, listarlos como bloqueante para el usuario).

2. **Baselines visuales del spec 27**
   - Generar snapshots con `playwright test 27-visual-regression --update-snapshots` contra staging.
   - Commitear `e2e/specs/__screenshots__/*.png` (o ruta que Playwright use según config).
   - Reemplazar máscara frágil `.text-xl, .text-2xl` por `data-testid` explícito en `TimelineEstadosCard`.

3. **Poblar variables gating en CI para specs 07–12, 25**
   - Documentar en `e2e/README.md` qué IDs de negocio requiere cada spec.
   - Extender `scripts/e2e/provision-users.ts` (o crear `provision-fixtures.ts`) para sembrar y exportar a `GITHUB_ENV` los IDs: `E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID`, `E2E_COTIZACION_ACEPTADA_ID`, `E2E_PROVEEDOR_ID`, `E2E_EMBARQUE_PARA_CXP_ID`, `E2E_HAS_SEED=1`, `E2E_HAS_AUDIT_DATA=1`.
   - `E2E_FISCAL=1` solo si `FACTURAPI_SANDBOX_KEY` está presente (specs 08/25).

## Ola 2 — Eliminar falsos verdes

4. **Convertir skips silenciosos en fallos explícitos**
   - En specs 02/18/21/22/23 y 06: si el env/data requerido falta, `test.fail("missing fixture: …")` en vez de `test.skip`, salvo bandera explícita `E2E_ALLOW_MISSING_FIXTURES=1` (útil solo en local).
   - En spec 06: si `E2E_CROSS_ORG_*` degrada a UUID dummy, marcar el test como `test.skip` con motivo (no `console.warn` invisible).

5. **Endurecer suite responsive (13–20)**
   - Añadir al menos 1 aserción de negocio por spec (p.ej. 13: KPI card con número; 18: portal muestra saldo del cliente; 14: cotización creada visible en lista).
   - Sustituir los 23 `waitForTimeout` por `waitForResponse`/`expect.poll` (empezar por 18-portal con 6 ocurrencias).

6. **Adopción de Page Objects**
   - Extraer POs para `cotizacion`, `cxp`, `portal`, `cliente` (los 4 flujos más repetidos).
   - Migrar specs de mayor duplicación (11, 12, 17, 20).

## Ola 3 — Cerrar gaps críticos (fiscal/dinero primero)

Un spec nuevo por gap, en orden de prioridad de la auditoría:

7. **Notas de crédito CFDI** (emisión → aplicación a saldo → cancelación) usando `facturapi-emitir-nota-credito` + `facturapi-cancelar-nota-credito`.
8. **Cancelación CFDI motivo 02/04 como flujo** (con `facturapi-reconciliar-cancelaciones` y verificación de acuse SAT).
9. **Habilitar spec 08 en CI** (una vez `E2E_FISCAL` esté armado en ola 1) + REP manual + `rep-retry-nocturno`.
10. **Conciliación bancaria real** en `/tesoreria/conciliacion` (matching de movimientos ↔ pagos). Renombrar spec 04 actual a `smoke-facturacion-tabs` para eliminar el nombre engañoso.
11. **Descarga CFDI en portal cliente** (`facturapi-descargar`, valida PDF y XML).
12. **CxC aging real** (buckets 0-30/31-60/61-90/+90 con fechas conocidas) y **workflow CxP aprobación** (`/compras/por-aprobar`).
13. **Costeo y admin** (tarifas + alta de usuario/rol/org) — cierre de gaps de mayor valor operativo.

## Detalles técnicos

- **Snapshots (paso 2):** Playwright guarda en `<spec>-snapshots/`. Confirmar con `snapshotPathTemplate` de `playwright.config.ts` antes de commitear.
- **Provisión de fixtures (paso 3):** el script debe ser **idempotente** — si el registro ya existe con tag `E2E_FIXTURE`, reutilizarlo; si no, crearlo. Escribir IDs a `$GITHUB_OUTPUT` para que el step siguiente los inyecte al env de Playwright.
- **Gate por secret (paso 3):** usar `if: env.FACTURAPI_SANDBOX_KEY != ''` a nivel step, no a nivel job, para no romper el job entero cuando el secret falta en un fork.
- **`test.fail` vs `test.skip` (paso 4):** Playwright no aborta el run con `test.fail` si el test efectivamente falla — es el comportamiento buscado. La bandera `E2E_ALLOW_MISSING_FIXTURES` se lee en `testBase.ts` fixture nuevo.
- **CHANGELOG + APP_VERSION** en cada ola (siguiendo memoria `mem://instructions/changelog-updates`).

## Fuera de alcance

- Cambiar a Vitest o a un runner distinto.
- Reescribir RLS o edge functions (la auditoría reconoce que RLS tiene su propio workflow `rls-tests.yml`).
- Tests unitarios adicionales — este plan es E2E puro.

## Nota

`.lovable/` está en tu `.gitignore`, así que este plan no se persistirá tras el próximo snapshot. ¿Quieres que lo saque del `.gitignore` para que los planes queden versionados?
