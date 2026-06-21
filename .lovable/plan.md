## Contexto

La app **ya tiene** un módulo de facturación CFDI 4.0 completo: edge functions `facturapi-emitir` y `facturapi-cancelar`, UI (`DialogTimbrarFactura`, `DialogCancelarFactura`), validaciones, catálogos SAT, datos fiscales por cliente, y campos fiscales en `facturas` (`uuid_fiscal`, `folio_fiscal`, `facturapi_id`, `factura_pdf_url`, `factura_xml_url`, etc.).

**Lo que falta** es el **Complemento de Pagos (REP)**: cuando una factura es **PPD** (Pago en Parcialidades o Diferido) y el cliente paga, el SAT obliga a emitir un *Recibo Electrónico de Pago* timbrado dentro de los primeros 5 días naturales del mes siguiente al pago. Hoy `pagos_factura` se registra como dato contable interno, pero no se timbra nada con el SAT.

También se hará el cambio de ambiente para arrancar en **sandbox de Facturapi**.

## Analogía

Hoy emitir una factura es como entregar un recibo oficial al cliente. Pero si le diste plazo para pagar (PPD), cada vez que él te abone una parte el SAT exige que entregues **otro recibo oficial** que diga "recibí este abono, aquí va el desglose, este es el saldo restante". A eso le llamamos REP. Hoy registramos el abono en nuestro cuaderno (`pagos_factura`) pero no le entregamos el recibo oficial al SAT.

## Alcance — 3 capas

### 1) Configuración (sandbox)

- Agregar dos secretos: `FACTURAPI_KEY` (sandbox) y `FACTURAPI_ENV` (`test` | `live`).
- Cambiar `FACTURAPI_BASE` en `helpers.ts` para que respete `FACTURAPI_ENV`:
  - `test` → `https://www.facturapi.io/v2` con la **test key** (Facturapi distingue por tipo de key, no por host; documentar esto).
- En la UI, badge discreto "Modo pruebas" en `DialogTimbrarFactura` cuando `FACTURAPI_ENV=test`. Expuesto vía función read-only o env público no sensible.

### 2) Base de datos — REP en `pagos_factura`

Nueva migración que añade a `pagos_factura`:

```
facturapi_rep_id     text
uuid_rep             text
folio_rep            integer
serie_rep            text
rep_pdf_url          text
rep_xml_url          text
estado_rep           text  -- 'NoAplica' | 'Pendiente' | 'Timbrado' | 'Cancelado' | 'Error'
timbrado_rep_en      timestamptz
timbrado_rep_por     uuid references auth.users
rep_error            text
rep_cancelado_en     timestamptz
rep_motivo_cancel    text
```

Sin cambios destructivos. Default de `estado_rep`:
- `'NoAplica'` si la factura asociada es **PUE** (no requiere REP).
- `'Pendiente'` si la factura es **PPD**.

Trigger `AFTER INSERT` en `pagos_factura` que setea `estado_rep` según `facturas.metodo_pago`. Backfill en la misma migración para los pagos existentes.

Vista helper `v_pagos_rep_pendientes` filtrando `estado_rep = 'Pendiente'` y `factura.estado IN ('Emitida','Parcial')`, para feeds y dashboards.

### 3) Edge functions REP

Tres nuevas, espejo de las de emisión:

#### `facturapi-emitir-rep`
- Entrada: `{ pago_id }`.
- Carga `pagos_factura` + `facturas` + `clientes` + (si aplica) otros pagos previos para calcular `num_parcialidad` e `imp_saldo_anterior`.
- Construye el payload del complemento de pago Facturapi v2 (`type: "P"`, `complements: [...]`).
- Llama a Facturapi, persiste `facturapi_rep_id`, `uuid_rep`, `folio_rep`, `rep_pdf_url`, `rep_xml_url`, `estado_rep='Timbrado'`, `timbrado_rep_en/por`.
- En error: `estado_rep='Error'`, `rep_error=...`, bitácora.
- Validaciones espejo de `validateContext` adaptadas a REP (RFC, régimen, CP, moneda, tipo de cambio si ≠ MXN, monto pago > 0, factura debe tener `uuid_fiscal`).

#### `facturapi-cancelar-rep`
- Entrada: `{ pago_id, motivo: '01'|'02'|'03'|'04', sustituye_uuid? }`.
- Cancela en Facturapi, marca `estado_rep='Cancelado'`, `rep_cancelado_en`, `rep_motivo_cancel`.

#### Helpers compartidos
- Extraer `basicAuthHeader`, `FACTURAPI_BASE` y validadores comunes a `supabase/functions/_shared/facturapi.ts` (hoy viven en `facturapi-emitir/helpers.ts`). `facturapi-cancelar` y los nuevos REP importan de ahí.

### 4) Servicios + hooks frontend

- `src/features/facturacion/services/repFacturapi.ts` con `emitirRep(pagoId)` y `cancelarRep(pagoId, motivo, sustituyeUuid?)` (espejo de `facturapi.ts`).
- `src/features/facturacion/hooks/useTimbrarRep.ts` con `useTimbrarRep` y `useCancelarRep` (espejo de `useTimbrarFactura`).
- `src/features/facturacion/utils/validarDatosTimbradoRep.ts` con `buildChecksTimbradoRep` (puro, testeable).

### 5) UI

- `DialogTimbrarRep.tsx` (espejo de `DialogTimbrarFactura.tsx`): checklist de prerequisitos (UUID factura, moneda, tipo cambio, RFC receptor, monto>0), botón "Timbrar REP", muestra resultado.
- `DialogCancelarRep.tsx`.
- En `DialogHistorialPagos.tsx` agregar columna **Estado REP** con badge (`NoAplica`/`Pendiente`/`Timbrado`/`Cancelado`/`Error`), botón "Timbrar REP" cuando `Pendiente`, links a PDF/XML cuando `Timbrado`, botón "Cancelar REP" cuando `Timbrado`.
- En `FacturaDetalle.tsx` (tab Pagos) mostrar el mismo estado REP por pago.

### 6) Bandeja y dashboard

- Nueva tarjeta en `DashboardEjecutivoFacturacion`: **"REP pendientes este mes"** (cuenta `estado_rep='Pendiente'`, agrupado por días restantes al 5 del mes siguiente, alerta roja si quedan ≤ 2 días).
- Item en sidebar de Facturación: "REP pendientes (N)".
- Toast/email opcional al cobrar un PPD recordando "Recuerda timbrar el REP" (deferido, sólo si el usuario lo pide).

### 7) Tests

- `validarDatosTimbradoRep.test.ts` — checks puros.
- `repFacturapi.test.ts` — mock de `supabase.functions.invoke`.
- `supabase/functions/_shared/facturapi.test.ts` — helpers compartidos.
- `supabase/functions/facturapi-emitir-rep/helpers_test.ts` — construcción del payload REP (parcialidad, saldo anterior, IVA traslados/retenciones).
- Regla nueva opcional en `validar_cierre_embarque`: bloquear cierre si hay pagos PPD con `estado_rep='Pendiente'` (a confirmar contigo si lo quieres dentro de esta entrega o aparte).

### 8) Bitácora y changelog

- `bitacora_actividad`: acciones `facturapi_rep_emitido`, `facturapi_rep_emitir_failed`, `facturapi_rep_cancelado`.
- `CHANGELOG.md` entrada `[13.91.0]` describiendo el módulo REP y el toggle sandbox. Bump `APP_VERSION` 13.91.0.

## Secretos a solicitar

- `FACTURAPI_KEY` — la **test secret key** de tu organización Facturapi (la encuentras en facturapi.io → Dashboard → Configuración → API Keys → "Test Secret Key", empieza con `sk_test_`).
- `FACTURAPI_ENV` — valor `test` por ahora. Cuando pasemos a vivo lo cambias a `live` y rotas la key a la `sk_live_...`.

Te pediré ambos con el form seguro en cuanto apruebes el plan.

## Lo que NO entra (lo dejamos fuera explícitamente)

- Complemento Carta Porte (lo descartaste).
- Facturas para clientes extranjeros / comerciales no fiscales.
- Cambio de PAC.
- Webhook de Facturapi para sincronizar cancelaciones automáticas (lo podemos sumar en una iteración aparte).
- Sustitución de CFDI con relación 04 desde UI (sólo lo dejamos posible vía parámetro `sustituye_uuid` en cancelar).

## Riesgos / cosas a confirmar contigo

1. **Multi-tenant**: la `FACTURAPI_KEY` es por organización Facturapi. Si más de una `organization` tuya emite facturas, vamos a necesitar **una key por organización** (guardada por organización, no como secret global). ¿Hoy es un solo emisor o varios? Si es uno solo, dejamos un solo secret. Si son varios, agregamos columna `facturapi_test_key` / `facturapi_live_key` en `organizations` y el edge function la lee de ahí.
2. **Regla de cierre**: ¿quieres que un embarque PPD no se pueda cerrar mientras tenga REPs pendientes? Mi recomendación: sí, lo metemos en el checklist de cierre.
3. **Orden de implementación interno** una vez aprobado: (a) secretos + toggle sandbox, (b) migración DB, (c) helpers compartidos + edge functions, (d) servicios/hooks/utils, (e) UI dialogs + integración en DialogHistorialPagos + FacturaDetalle, (f) dashboard, (g) tests, (h) changelog. Todo en este plan, en este orden, en build mode.