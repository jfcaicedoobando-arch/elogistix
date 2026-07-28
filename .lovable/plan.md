## Qué pasó (en corto)

La factura de proveedor **FiscLYD-2046203** (17:26:50, misma hora del reporte) quedó con `uuid_estatus_sat = 'Error'`, y el toast genérico "SAT no devolvió un estatus válido" es lo que se disparó.

**Causa confirmada (consultada en la base):** el RFC del proveedor está guardado como `AL&amp;0807074L5` en vez de `AL&0807074L5`.

Analogía: el XML del CFDI escribe el símbolo `&` en "clave morse" (`&amp;`). Nuestro lector copió la clave morse tal cual en vez de traducirla, así que le pedimos al SAT un RFC que no existe y el SAT contesta algo que no sabemos interpretar.

Hay 2 facturas afectadas hoy (las únicas con `&` en el RFC).

## Bugs a corregir

**1. El parser de CFDI no decodifica entidades XML** — `supabase/functions/parse-cfdi-xml/parser.ts`, función `attr()`: devuelve el valor crudo del atributo. Se añade un `decodeXmlEntities()` (`&amp; &lt; &gt; &quot; &apos; &#NN; &#xNN;`) aplicado a todos los atributos de texto (RFC, Nombre, Descripción, Serie, Folio). Tests en `parser_test.ts` con `Rfc="AL&amp;0807074L5"` y `Nombre="ACME &amp; CO"`.

**2. El sobre SOAP al SAT no escapa los valores** — `supabase/functions/verificar-uuid-sat/index.ts`, `buildSoapEnvelope()`: interpola RFC/UUID directo. Aunque el dato ya venga limpio, un `&` real rompe el XML del request. Se añade escape del valor (solo `&`, `<`, `>`) antes de armar la expresión, manteniendo `&amp;` como separador de parámetros.

**3. El parser de la respuesta del SAT es frágil** — el regex `/<[a-z]:?Estado>/i` exige prefijo de namespace de una sola letra; si el SAT responde `<Estado>` o `<ns1:Estado>` no matchea y cae en `Error`. Se cambia a `/<(?:[\w.-]+:)?Estado>/i` (mismo tratamiento para `CodigoEstatus`).

**4. El mensaje de error no dice nada** — `src/features/cxp/hooks/useVerificarUuidSat.ts` descarta el campo `raw` que ya devuelve la edge function. El toast del caso `Error` pasará a incluir el código/estado del SAT (ej. "SAT respondió: N - 601 | La expresión impresa proporcionada no es válida"), y en el caso de RFC/UUID faltantes se mostrará el motivo concreto en vez del genérico. También se registrará `raw` como contexto en Sentry.

**5. Datos ya contaminados** — migración de backfill que corre `replace()` de las entidades sobre `proveedor_facturas.rfc_proveedor` y `razon_social`/nombre del proveedor donde contengan `&amp;` u otras entidades (2 filas hoy), y se resetea su `uuid_estatus_sat`/`uuid_verificado` a nulo para que se puedan re-verificar.

## Verificación

- `deno test` de `parse-cfdi-xml` y de la edge function de SAT.
- `bunx vitest run src/features/cxp`.
- Consulta post-migración confirmando 0 RFCs con entidades XML.
- Re-verificar manualmente la factura FiscLYD-2046203 desde `/compras/por-aprobar`.
- `bun run lint --max-warnings 0`, `audit:migrations`.
- Bump `APP_VERSION` a `13.320.62` + entrada en `CHANGELOG.md`, y marcar el issue de Sentry como `resolved`.

## Nota técnica

El `attr()` con regex se mantiene (migrar a DOM está fuera de alcance aquí); el fix es puntual en la decodificación de entidades, que es exactamente donde se pierde la información.
