# Actualizar Facturapi 5.2.0 -> 6.0.0

## Hallazgos
- El ERP usa `facturapi@5.2.0`, importado sólo desde `supabase/functions/_shared/facturapiClient.ts`. La versión más reciente es **6.0.0** (publicada el 02/11/2026; en su propio registro de cambios aún dice "Unreleased").
- Lo que usa el ERP: `invoices.create` (factura, NC y REP), `retrieve`, `list`, `paymentSummary` y la descarga mensual en ZIP (`createZipRequest`/`retrieveZipRequest`/`downloadZipRequest`). No usa recibos, retenciones, series, certificados ni dominios.

## Qué rompe la v6 y cómo nos afecta
| Cambio en v6 | Impacto en el ERP |
|---|---|
| Las fechas de las respuestas llegan como fecha (`Date`), no como texto | Medio. `match.date` se guarda en `timbrado_en`/`timbrado_rep_en` (en la recuperación de factura, NC y REP). Al guardar se convierte a texto ISO, pero hay que normalizarlo de forma explícita y revisar el ZIP mensual (`created_at`/`expires_at`). |
| Tipos más estrictos de CFDI/complementos | Bajo. Nuestro cliente es un objeto opaco y tiene casts en un solo lugar (`facturapiSdk.ts`). |
| Cambia cómo se empaqueta el SDK (`index.mjs`/`index.cjs`; ya no se permite importar `dist/...`) | Revisar que el import por defecto (con su `default.default`) siga resolviendo bien en el entorno de Edge. |
| Series, recibos, retenciones, certificados y dominios | Sin impacto (no los usamos). |
| Lo nuevo (salud del servicio, filtros `sat_imported`, FIEL, etc.) | No se adopta (YAGNI). |

Analogía: es como cambiar el modelo de la impresora fiscal. Los botones que usamos son los mismos, pero ahora el ticket trae la fecha con otro formato y hay que leerla bien.

## Pasos
1. **Fechas:** crear un helper pequeño `aIsoFacturapi(valor)` (acepta texto o `Date` y regresa ISO) en `_shared/facturapiSdk.ts`. Usarlo en los 3 `timbrado_en` de recuperar-claim y en los campos de fecha del ZIP mensual y de la conciliación (`facturapi-consultar`).
2. **Versión fija:** cambiar `npm:facturapi@5.2.0` por `@6.0.0` en `facturapiClient.ts` (y actualizar su comentario de historial), y alinear `package.json` como devDependency exacta `6.0.0` (regla de AGENTS.md). Hoy esa dependencia ni siquiera está listada; lo corrijo en el mismo cambio.
3. **Pruebas:** actualizar `SDK_VERSION` en `facturapi-multi-tenant.test.ts` y el texto esperado en `facturapiSdk_test.ts`. Agregar una prueba del helper con texto, `Date` y nulo.
4. **Verificación enfocada:** pruebas Deno de `_shared` y recuperar-claim, la prueba de arquitectura y un arranque real de una función (`facturapi-consultar`) para confirmar que el SDK carga. Después, desplegar sólo las funciones de Facturapi.
5. **Antes de producción:** hacer un timbrado de prueba en sandbox (factura, NC y REP) con tu autorización. No se timbra nada real ni se envían correos.

## Fuera de alcance
No cambia la interfaz, la base de datos, las migraciones ni la versión/CHANGELOG (salvo que lo autorices). No se publica. El CI completo queda para GitHub Actions.

## Riesgo
La v6 es muy reciente (8 días) y su registro de cambios todavía dice "Unreleased". Alternativa conservadora: esperar a la 6.0.1 y por ahora sólo hacer el paso 1, que también funciona con la v5.
