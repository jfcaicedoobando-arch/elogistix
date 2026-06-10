# Fix: IVA y retenciones en 0 al cargar XML CFDI

## Causa raíz

En `supabase/functions/parse-cfdi-xml/parser.ts`, la línea:

```ts
const totImp = findTag(xml, "Impuestos");
```

devuelve el **primer** `<cfdi:Impuestos>` del XML. En la gran mayoría de CFDIs 4.0 ese primer match es el bloque de impuestos **anidado dentro de un `<cfdi:Concepto>`**, que no contiene los atributos `TotalImpuestosTrasladados` ni `TotalImpuestosRetenidos`. Esos atributos sólo existen en el `<cfdi:Impuestos>` raíz (hijo directo de `<cfdi:Comprobante>`, declarado al final del documento).

Resultado: `iva_trasladado = 0` y `retenciones = 0`, y al precargar el formulario los campos quedan vacíos.

## Cambios

### 1. `supabase/functions/parse-cfdi-xml/parser.ts`

- Reemplazar la extracción única por una estrategia que ubique el `<Impuestos>` raíz:
  1. Buscar **todos** los `<Impuestos>` con `findAllTags`.
  2. Tomar el que tenga atributo `TotalImpuestosTrasladados` o `TotalImpuestosRetenidos` (es el del Comprobante).
  3. Si ninguno los tiene (CFDIs viejos o exentos donde el bloque raíz se omite), sumar:
     - IVA: todos los `<Traslado>` con `Impuesto="002"` → atributo `Importe`.
     - Retenciones: todos los `<Retencion>` → atributo `Importe`.

Esto cubre los 3 casos reales:
- CFDI con totales explícitos a nivel Comprobante (mayoría).
- CFDI sin totales pero con traslados/retenciones por concepto.
- CFDI exento (queda en 0, correcto).

### 2. `supabase/functions/parse-cfdi-xml/parser_test.ts`

Agregar 2 tests:
- CFDI donde el primer `<Impuestos>` es de concepto y el segundo (raíz) trae los totales → debe extraer 160 / 0.
- CFDI sin bloque raíz de Impuestos pero con `<Traslado Impuesto="002" Importe="160"/>` y `<Retencion Importe="100"/>` dentro de un concepto → debe sumar a 160 / 100.

### 3. `src/constants/appVersion.ts` + `CHANGELOG.md`

Bump de versión patch y entrada:
> Corregido: el desglose de IVA y retenciones al cargar CFDI XML ahora toma el bloque de impuestos del Comprobante, no el del primer Concepto.

## Validación

- `deno test supabase/functions/parse-cfdi-xml/parser_test.ts` (los 4 existentes + 2 nuevos pasan).
- Cargar el mismo XML en CxP → IVA y retenciones precargados correctamente y el Total reconciliado.

## Notas

- Sólo se toca el parser del edge function y sus tests. El hook `useNuevaFacturaProveedorForm` ya hace `String(c.iva_trasladado || "")`, así que con el parser arreglado los campos se precargan sin más cambios.
- No se modifica el componente UI ni la lógica de submit.
