## Objetivo

El error `P0001: "Cliente sin código postal válido"` bloquea la conversión Proforma → Borrador. Ya no tiene sentido validar datos fiscales al crear el borrador: con FacturAPI como source of truth, esas validaciones deben ocurrir **al timbrar** (donde ya existen en `facturapi-emitir/helpers.ts`).

## Cambios en la base de datos

Actualizar la función `public.convertir_proformas_a_factura` (última definición en `20260702211446_...sql`) para **eliminar** los tres bloques de validación fiscal:

```sql
-- QUITAR:
IF v_cliente.rfc IS NULL OR length(v_cliente.rfc) < 12 THEN
  RAISE EXCEPTION 'Cliente sin RFC válido';
END IF;
IF v_cliente.codigo_postal IS NULL OR v_cliente.codigo_postal !~ '^\d{5}$' THEN
  RAISE EXCEPTION 'Cliente sin código postal válido';
END IF;
IF v_cliente.regimen_fiscal IS NULL OR v_cliente.regimen_fiscal = '' THEN
  RAISE EXCEPTION 'Cliente sin régimen fiscal';
END IF;
```

Se conservan el resto de validaciones (misma organización, proformas no facturadas, serie válida, RLS por `_assert_writer`). El borrador puede quedar con `rfc_cliente` vacío; se copiará el que exista al momento de conversión y se validará al timbrar.

## Cambios en el frontend

Aviso en el borrador cuando el cliente tiene datos fiscales incompletos. En `FacturaDetalle.tsx` (o en `FacturaDetalleHeader.tsx`, junto al chip "Sin folio (borrador)"):

- Consultar los campos `rfc`, `codigo_postal`, `regimen_fiscal` del cliente ligado.
- Si faltan, mostrar un `Alert` amarillo tipo advertencia con:
  - Texto: "Este borrador no puede timbrarse todavía. Faltan datos fiscales del cliente: <lista>."
  - Botón/enlace "Completar datos del cliente" → `/clientes/:clienteId/editar` (o la ruta equivalente ya existente).
- El botón "Timbrar" queda habilitado; si el usuario lo intenta, `facturapi-emitir` devolverá el mismo mensaje estructurado que ya emite (`isValidRfc`, `isValidZip`, `tax_system`). No duplicamos validación en cliente.

Opcional (mismo scope, bajo costo): pequeño badge "Datos fiscales incompletos" en la columna Cliente de `facturacionColumns.tsx` para borradores. Lo dejo fuera si prefieres mantener el cambio mínimo — indícalo al aprobar.

## Detalles técnicos

- Migración: `CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(...)` con el cuerpo íntegro menos los tres `RAISE`. Se mantiene la firma (mismos parámetros y `RETURNS SETOF public.facturas`) para no romper el RPC tipado.
- No hay que tocar `facturapi-emitir` — ya reporta los tres errores fiscales con `field`+`message`.
- El toast de `notifyError` ya mostrará el mensaje detallado de FacturAPI cuando el usuario intente timbrar sin CP.
- Bump `APP_VERSION` → `13.146.1` + entrada en `CHANGELOG.md`: "Fix: convertir proforma a factura ya no exige datos fiscales del cliente; la validación ocurre al timbrar (consistente con FacturAPI = source of truth)."

## Fuera de alcance

- No se cambia el flujo de timbrado ni las validaciones de `facturapi-emitir`.
- No se agrega captura inline de CP en el borrador; el usuario edita al cliente.
- No se toca `facturaManual.ts`.
