# Corregir falso "El CFDI no cuadra" al subir factura de proveedor

## Qué está pasando

El XML del proveedor trae líneas con cantidad mayor a 1. El lector de XML guarda el importe **por unidad** (no el total de la línea), porque así lo espera el resto del sistema. Pero el validador que revisa si el CFDI "cuadra" suma esos importes **sin multiplicarlos por la cantidad**.

Analogía: es como sumar el precio de un café (155) cuando en realidad compraste tres (435). El CFDI sí cuadra; quien suma mal es el validador.

Verificado en el código:
- `supabase/functions/parse-cfdi-xml/parser.ts` normaliza `importe` a valor unitario (usa `ValorUnitario`, o `Importe / Cantidad`).
- `src/features/cxp/services/validarCuadreCfdi.ts` suma `c.importe` directo contra el subtotal, ignorando `cantidad`.

Los 155.00 vs 435.00 del mensaje corresponden exactamente a esta división.

## Qué se va a cambiar

1. En el validador de cuadre, calcular el total de cada línea como `importe × cantidad` (cantidad nula o 0 = 1), igual que ya lo hace `totalLinea` en `src/features/cxp/utils/cuadreConceptos.ts`, y comparar esa suma contra el subtotal del CFDI.
2. Reutilizar el helper existente `totalLinea` para que exista una sola regla de "total de línea" en todo el sistema.
3. Agregar tests en `src/features/cxp/services/__tests__/validarCuadreCfdi.test.ts`: un CFDI con cantidad 3 y unitario 145 que ahora debe aceptarse, y uno realmente descuadrado que debe seguir rechazándose.
4. Actualizar `CHANGELOG.md` y subir `APP_VERSION`.

No se toca el lector de XML ni la lógica de IVA/IEPS/retenciones: esas validaciones ya son correctas porque los impuestos vienen por línea completa.

## Alcance

Sólo frontend (validación de captura CxP) + tests. Sin migraciones de base de datos.
