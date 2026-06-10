## Causa raíz

En `supabase/functions/parse-csf/index.ts` línea 123:

```ts
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
```

El spread `...new Uint8Array(arrayBuffer)` pasa cada byte del PDF como argumento individual a `String.fromCharCode`. Cuando el PDF supera ~100KB el motor V8 revienta el stack y devuelve `Maximum call stack size exceeded` (visible en los logs del edge function del contador).

Esto explica por qué algunos CSF chicos sí funcionan y los del contador (PDFs SAT más pesados) fallan con toast genérico.

## Fix

Reemplazar la conversión a base64 en `parse-csf/index.ts` por una codificación por chunks que no use spread:

```ts
const bytes = new Uint8Array(await file!.arrayBuffer());
const CHUNK = 0x8000; // 32 KB
let binary = "";
for (let i = 0; i < bytes.length; i += CHUNK) {
  binary += String.fromCharCode.apply(
    null,
    bytes.subarray(i, i + CHUNK) as unknown as number[]
  );
}
const base64 = btoa(binary);
```

Esto procesa el PDF en bloques de 32 KB, eliminando el stack overflow sin cambiar el contrato de la función (sigue mandando el mismo base64 a Gemini).

## Pasos

1. Editar `supabase/functions/parse-csf/index.ts` con la conversión por chunks.
2. Redeploy de `parse-csf` (automático en Lovable Cloud).
3. Probar con `supabase--curl_edge_functions` que no devuelva el error de stack.
4. Bump `APP_VERSION` a `12.76.16` y entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se tocan controllers, dialogs, ni la tabla `proveedores`.
- No se cambia el prompt ni el schema de Gemini.
- No se modifica el flujo del cliente (cliente usa otra ruta de upload distinta).