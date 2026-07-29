## Objetivo

Aplicar los 12 hallazgos ALTOS del documento de auditoría (A1–A12), en orden, verificando cada FIX contra el código real antes de tocarlo.

Verifiqué ya dos puntos de partida: `FacturaPagosSection.tsx` y `DialogRegistrarPago.tsx` calculan el saldo **sin restar notas de crédito** (existe el canon correcto en `portal/services/facturaSaldo.ts`), y `eslint.config.js` sí tiene una lista `FEATURES` incompleta. El resto de los FIX se validará archivo por archivo justo antes de aplicarlos; si algún hallazgo no coincide con el código actual, lo reporto en vez de aplicarlo a ciegas.

## Ola 1 — Dinero y consistencia de datos (frontend)

- **A1 — Canon de saldo de factura.** Promover `facturaSaldo.ts` a `src/lib/domain/` (o equivalente compartido) como única fórmula `total − Σpagos − ΣNC`, y consumirla en `FacturaPagosSection`, `DialogRegistrarPago` (incluida la validación de "excede saldo"), cobranza y estado de cuenta. Tests unitarios del canon + test de que el diálogo no permite sobrepago cuando hay NC.
- **A5 — Invalidación cruzada portal↔interno de cotizaciones**, usando los builders de query keys.
- **A8 — QueryKeys muertas/faltantes** (guion vs guion bajo): corregir claves e invalidaciones que nunca hacían match.

## Ola 2 — Tipos y guardarraíles

- **A2 — Canonizar `Factura`/`Cliente`/`Proveedor`/`EmbarqueRow`** derivándolos de `Tables<>`.
- **A3 — Eliminar `as never`** donde el tipo ya existe, más regla ESLint anti-`as never`.
- **A4 — Completar `FEATURES`** en `eslint.config.js` (añadir `anticipos-proveedor`, `cobranza`, `cxc`) y registrar los 5 imports cross-feature ya existentes en la allowlist con comentario de burn-down.
- **A7 — ZIP masivo CFDI**: reportar fallos parciales al usuario y dejar rastro en bitácora.
- **A9 — Caps ocultos de listados**: límite explícito y aviso de truncamiento.

## Ola 3 — Permisos y RLS (2 migraciones)

- **A6 — PNL/márgenes fuera del alcance de clientes y agentes**: `cerrado_snapshot`, `pnl_financiero_embarque`, `reabrir_embarque` (migración).
- **A10 — Alinear `es_escritor_financiero` con la matriz de `usePermissions`** y RLS de `conceptos_factura` (migración).

Ambas se acompañan de pruebas en la suite RLS existente (`supabase/tests/rls/`) para que el gate de despliegue las cubra.

## Ola 4 — Modelo de datos financiero (2 migraciones)

- **A11 — Dinero en JSONB → tablas hijas (fase 1)** para `cotizaciones.conceptos_venta` y `factura_notas_credito.conceptos`: crear tablas con GRANTs + RLS, backfill idempotente y lectura dual (sin quitar todavía el JSONB).
- **A12 — FKs e índices faltantes** en tablas de dinero.

## Detalles técnicos

- Migraciones idempotentes (`IF NOT EXISTS`, guards `DO $$`, `ON CONFLICT`), sin `CONCURRENTLY`, con `GRANT` obligatorio en toda tabla nueva del esquema `public`.
- Convenciones del repo: capas Pages→Hooks→Services→Lib, query keys sólo por builders, toasts sólo con `notifySuccess/notifyError/notifyWarning`, errores con `reportCaughtError`, máximo 200 líneas por archivo.
- Tras cada ola: `bun run lint --max-warnings 0`, `tsc`, tests de arquitectura y la suite de tests afectada; `audit:migrations` en las olas 3 y 4.
- Al cierre de cada ola: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se elimina el JSONB de A11 (eso sería fase 2, tras convivencia en producción).
- No se ejecuta el burn-down completo de la allowlist de A4 (queda documentado como deuda con plan).
