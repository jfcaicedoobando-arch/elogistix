# Fix: CFDI de proveedor no cuadra por tope artificial de conceptos

## Analogía

Es como si al capturar una nota del súper con 11 renglones, la caja registradora sólo leyera los primeros 10 y luego se quejara de que "la suma no da". El XML está sano; nosotros lo estamos recortando.

## Diagnóstico (verificado)

- El XML subido trae **11 conceptos** cuya suma de `Importe` = **11,268.49 USD** = `SubTotal` = `Total`. El CFDI cuadra perfectamente.
- `validarCuadreCfdi` (front) recibe sólo **10 conceptos** que suman **11,064.64** (falta el último: "VERIFIED GROSS WEIGHT" 203.85). Diferencia = 203.85 → mismo número que reporta el toast.
- Causa: en `supabase/functions/parse-cfdi-xml/parser.ts:167` el edge function hace `findConceptoBlocks(xml).slice(0, 10)` como cap "anti-DoS". Los totales (`SubTotal`, `IVA`, `IEPS`) sí se leen del `<Comprobante>` completo, así que el desglose truncado nunca puede cuadrar contra el subtotal cuando hay >10 líneas.
- Es un patrón normal en facturación marítima (fletes desglosan BAF, THC, DOC, etc.) — 11–30 líneas es común y no es abuso.

## Cambio propuesto (1 archivo)

`supabase/functions/parse-cfdi-xml/parser.ts`
- Subir el tope a `200` conceptos (protección DoS razonable; un CFDI 4.0 real rara vez pasa de ~50).
- Mantener el `slice` como salvaguarda, sólo con umbral realista.

`supabase/functions/parse-cfdi-xml/parser_test.ts`
- Ajustar el test `"parseCfdi limita conceptos a 10 (anti-DoS)"` para reflejar el nuevo tope (probar con >200 y esperar `length === 200`, o con 11 y esperar `length === 11`).

Nota: el AI prompt (`sugerirCategoria`) ya sólo usa `descripcion`, así que 200 líneas no lo revientan; si acaso, dentro de `sugerirCategoria` podemos hacer un `slice(0, 30)` local sólo para el prompt del modelo, sin afectar la respuesta al front. Lo incluyo en el mismo edit para mantener costo/latencia del LLM acotados.

## Verificación

1. Re-parsear el XML adjunto: `conceptos.length === 11`, suma = 11,268.49, `validarCuadreCfdi` → `ok: true`.
2. `deno test supabase/functions/parse-cfdi-xml/` en verde.
3. Deploy del edge function (`parse-cfdi-xml`) para que el fix tome efecto (los edge functions no se recompilan solos con el bundle del front).

## Housekeeping

- Bump `APP_VERSION` a `13.303.63`.
- Entrada en `CHANGELOG.md` referenciando el requestId `040d7609-0969-4560-821c-ee21221a7cb5`.
- No hay issues de Sentry abiertos ligados (es error controlado del validador, no excepción).

## Fuera de alcance

- Rediseñar `validarCuadreCfdi` — funciona bien; el problema era el input truncado.
- Cambios en UI del modal de captura.
