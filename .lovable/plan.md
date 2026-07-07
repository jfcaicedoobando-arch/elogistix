## Problema

El test `demo-access/index_test.ts` (línea 14) todavía busca el string literal `"Access-Control-Allow-Origin": "*"` en el código fuente. En el fix anterior del botón "Probar demo" migramos la función `demo-access` a CORS estricto (`corsHeaders` importado de `_shared/cors.ts`), así que el test quedó desactualizado y rompe el shard "Edge Functions (Deno tests)".

Es la única falla del CI (1 failed, 283 passed).

## Cambios

**1. `supabase/functions/demo-access/index_test.ts`**

Reemplazar la aserción del preflight para que verifique el nuevo contrato (CORS estricto compartido) en vez del wildcard:

- Mantener `assertStringIncludes(indexSource, 'req.method === "OPTIONS"')`.
- Cambiar `'"Access-Control-Allow-Origin": "*"'` por dos aserciones:
  - `assertStringIncludes(indexSource, 'from "../_shared/cors.ts"')`
  - `assertStringIncludes(indexSource, "corsHeaders")`

Esto sigue protegiendo contra regresiones (que se olvide manejar OPTIONS o quitar CORS), pero alineado con la política de CORS estricto del proyecto.

**2. `CHANGELOG.md` + `src/constants/appVersion.ts`**

Bump a `13.209.7` con nota: "Fix · Test demo-access alineado con CORS estricto (`_shared/cors.ts`)".

## Verificación

- `deno test supabase/functions/demo-access/` debe pasar los 5 tests.
- No hay cambios de lógica de runtime; sólo el test y el changelog.

## Analogía

El test era como un guardia que revisaba que la puerta tuviera un letrero exacto que decía "abierto a todos". Cambiamos la puerta a una con lista de invitados (CORS estricto), pero olvidamos actualizar al guardia — sigue buscando el letrero viejo y reporta que "algo está mal". Actualizamos las instrucciones del guardia para que verifique la lista de invitados.
