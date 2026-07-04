## Problema

Karol intenta convertir la proforma `7e6dcaca…` a factura y el backend responde:

> Embarque cerrado: edición bloqueada (tabla facturas) — código `23514`

## Causa raíz (analogía)

Piensa en el embarque cerrado como una carpeta sellada con cinta. Hoy la cinta bloquea **todo** lo que quieras meter en la carpeta: documentos operativos (correcto) **y también** las facturas y pagos (incorrecto — esos justamente ocurren *después* del cierre).

Técnicamente, el trigger `tg_bloquear_si_embarque_cerrado` está enganchado a 10 tablas. En 6 tiene sentido (conceptos, documentos, contenedores, eventos, seguros). En las 4 fiscales/tesorería **rompe el flujo normal**:

- `facturas` ← bloquea convertir proforma → factura
- `pagos_factura` ← bloquearía registrar cobros del cliente
- `proveedor_facturas` ← bloquearía capturar CxP
- `pagos_proveedor` ← bloquearía pagar al proveedor

El cierre operativo del embarque no debe impedir la facturación ni la cobranza; esa es la práctica estándar de forwarders (y por eso el conversor de proforma no pone `app.bypass_cierre`).

## Cambio propuesto (migración, sin código React)

Retirar el trigger `trg_bloquear_cierre` únicamente de las 4 tablas fiscales/tesorería, dejándolo intacto en las 6 tablas operativas:

```text
Quitar en:  facturas · pagos_factura · proveedor_facturas · pagos_proveedor
Conservar:  conceptos_costo · conceptos_venta · documentos_embarque
            seguros_embarque · eventos_embarque · embarque_contenedores
```

SQL (una sola migración):

```sql
DROP TRIGGER IF EXISTS trg_bloquear_cierre ON public.facturas;
DROP TRIGGER IF EXISTS trg_bloquear_cierre ON public.pagos_factura;
DROP TRIGGER IF EXISTS trg_bloquear_cierre ON public.proveedor_facturas;
DROP TRIGGER IF EXISTS trg_bloquear_cierre ON public.pagos_proveedor;
```

No se toca la función `tg_bloquear_si_embarque_cerrado` (sigue viva para las otras tablas) ni el trigger de `conceptos_venta`/`conceptos_costo`, así que la protección operativa se mantiene.

## Fuera de alcance

- Nada de RLS, ni cambios en el RPC `convertir_proformas_a_factura`, ni cambios en React.
- No se modifican los triggers de conceptos ni de embarques.

## Cierre

- Bump `APP_VERSION` a `13.170.21` y entrada en `CHANGELOG.md`.
- Marcar el issue de Sentry como resolved al aplicar el fix.

## Verificación

Karol reintenta "Convertir a factura" en la proforma `7e6dcaca…`; debe generarse el borrador sin el error 23514. Los intentos de editar conceptos del mismo embarque cerrado deben seguir fallando (regla operativa).
