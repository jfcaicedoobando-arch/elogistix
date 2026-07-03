## Diagnóstico

Los logs de la edge function `facturapi-emitir` muestran el error real (el `non-2xx` del cliente es la consecuencia, no la causa):

```
[facturapiClient] SDK import failed
TypeError: Could not find constraint 'facturapi@4.18.0' in the list of packages.
  code: "ERR_MODULE_NOT_FOUND"
```

Este mensaje viene del runtime de Deno cuando el especificador `npm:` **no** aparece en el grafo de paquetes que el runtime pre-resuelve al arrancar el worker. En `supabase/functions/_shared/facturapiClient.ts` el SDK se carga así:

```ts
const sdkSpec = "npm:facturapi@4.18.0";
const sdkModulePromise = import(sdkSpec).then(...);
```

Un `import()` **dinámico** con `npm:` no participa en el análisis estático del worker: Supabase Edge Runtime construye la lista de paquetes solo a partir de imports estáticos, por eso `facturapi@4.18.0` no está registrado y falla en el `boot`.

Que el paquete exista en npm (verificado: `4.18.0` publicado 2026-06-08) no basta — el problema es el _dinamismo_ del import, no la versión.

**Analogía:** es como pedirle al mesero un platillo cuyo nombre no está en el menú impreso; aunque exista en la cocina, el mesero solo trae lo que está listado antes de abrir el turno.

## Cambios

1. **`supabase/functions/_shared/facturapiClient.ts`** — sustituir el `import()` dinámico por un `import` estático top-level:

   ```ts
   // Import estático: el runtime lo incluye en el grafo de paquetes.
   import Facturapi from "npm:facturapi@4.18.0";
   ```

   - Se elimina `sdkSpec`, `sdkModulePromise`, `sdkLoadError` y `loadFacturapiCtor`.
   - `getFacturapiClient` usa directamente `new Facturapi(apiKey)` (o `new (Facturapi as any)(apiKey)` si el default trae wrapper `.default`).
   - Se conserva la caché por `apiKey`, la firma pública, `describeFacturapiError` y `__resetFacturapiClientCacheForTests`.
   - Tipos: mantener `FacturapiClient = object` y `FacturapiCtorType = new (apiKey: string) => object` para no depender de tipos que el SDK no exporta.

2. **`src/constants/appVersion.ts`** → `13.170.11`.

3. **`CHANGELOG.md`** → entrada `[13.170.11] - 2026-07-04`:
   > **fix(facturación/timbrado)**: la edge function `facturapi-emitir` fallaba en boot con `Could not find constraint 'facturapi@4.18.0' in the list of packages` porque el SDK se cargaba con `import()` dinámico. Se cambia a `import` estático top-level para que el runtime de Deno incluya el paquete en el grafo. Deja de aparecer el `Edge Function returned a non-2xx status code` al timbrar. También aplica a las demás funciones que reutilizan `_shared/facturapiClient.ts` (`facturapi-cancelar`, `facturapi-emitir-rep`, `facturapi-emitir-nota-credito`, etc.).

## Verificación

- Pedir al usuario que reintente timbrar la factura `1ea459fa-9fda-41a2-a42a-0b7fd8123d7a`.
- Revisar logs de `facturapi-emitir` — ya no debe aparecer `[facturapiClient] SDK import failed`.
- Los tests Deno existentes (`_shared/facturapiClient_test.ts`) siguen pasando: sólo cambia la forma de obtener el ctor, no el contrato.

## Fuera de alcance

No se toca la resolución de API keys (`facturapiAuth.ts`) ni la lógica de negocio del timbrado.
