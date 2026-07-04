## Problema

En `DialogTimbrarFactura.tsx`, los valores `usoCfdi`, `formaPago`, `metodoPago` se inicializan con `useState(factura?.uso_cfdi ?? ...)`. Como `useState` sólo lee su valor inicial **una vez**, cuando el modal se monta antes de que `useFactura` termine de cargar (o antes de que `fetchClienteFiscal` regrese), el estado queda con los fallbacks (`G03`, `03`, `PUE`) y nunca se actualiza cuando llegan los datos guardados en la tarjeta "Configuración de timbrado".

Analogía: es como sacar copia al carbón antes de escribir el original — la copia sale en blanco aunque después llenes la hoja de arriba.

## Fix

En `src/features/facturacion/components/DialogTimbrarFactura.tsx`:

1. Agregar un `useEffect` que, cuando `factura` (y `cliente`) cambien mientras el modal esté abierto, re-sincronice los tres estados locales con los valores persistidos:

   ```ts
   useEffect(() => {
     if (!factura) return;
     setUsoCfdi(factura.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03");
     setFormaPago(factura.forma_pago ?? "03");
     setMetodoPago(factura.metodo_pago ?? "PUE");
   }, [factura?.id, factura?.uso_cfdi, factura?.forma_pago, factura?.metodo_pago, cliente?.uso_cfdi_default]);
   ```

2. También resetear `modoExpandido` a `false` cuando cambie la factura, para que el fast-path se re-evalúe con los datos frescos.

## Fuera de alcance

- No se toca la tarjeta `FacturaDatosFiscalesCard` ni el auto-save (ya funciona).
- No se cambia el edge function ni la base de datos.
- No se agregan campos (`tipo_cambio`, `notas`, `dias_credito`) al modal — sólo se corrige la propagación de los tres campos que el modal ya muestra.

## Versionado

- `src/constants/appVersion.ts` → `13.170.19`
- `CHANGELOG.md` → entrada `[13.170.19]` describiendo el fix.
