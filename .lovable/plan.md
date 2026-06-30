# Fix Sentry JAVASCRIPT-REACT-1S (regresión)

## Diagnóstico

El error en Sentry `Failed to send a request to the Edge Function` en `/configuracion` (versión `13.141.8`) **NO** es un timeout — es porque la edge function **nunca arranca correctamente**.

Edge function logs muestran:
```
event loop error: Uncaught (in promise) TypeError:
Could not find constraint 'facturapi@5' in the list of packages.
booted (time: 30ms)
```

**Causa:** En `13.141.9` movimos el `import("npm:facturapi@5")` a top-level del módulo `_shared/facturapiClient.ts` para pre-pagar el cold-start. Pero Deno edge-runtime no resuelve el specifier `npm:facturapi@5` (constraint con caret implícito). La promesa de import queda rechazada sin handler, el event loop revienta y el worker muere al primer request → el cliente recibe "Failed to send a request".

**Analogía:** El cocinero salió a comprar ingredientes con una receta mal escrita ("cebollas-talla-5"). El proveedor no entiende la talla, no le da nada, y el cocinero se desmaya antes de que llegue el primer cliente. Antes (con import dinámico) el cocinero al menos abría la cocina y fallaba sólo en el plato; ahora no abre la cocina.

## Cambios

### 1. `supabase/functions/_shared/facturapiClient.ts`
- Pinear el specifier a versión exacta: `npm:[email protected]` (última estable conocida; equivalente al constraint que pedíamos pero resoluble por Deno).
- Envolver el `import(sdkSpec)` top-level en una función con `.catch` que **no** propague la rejection no manejada: guardar el error y rethrow sólo cuando `loadFacturapiCtor()` se invoque. Así, aunque el SDK falle al cargar, el worker arranca y puede contestar otros requests (p. ej. cancelar-rep, webhook) con un error semántico en lugar de matar todo.
- Exportar `loadFacturapiCtor` con el manejo de error mejorado.

### 2. `supabase/functions/facturapi-test-conexion/index.ts`
- Mantener el `withTimeout(15s)` y los `console.log` por stage agregados en `13.141.9`.
- Si `loadFacturapiCtor` falla, responder `{ ok: false, error: "facturapi_sdk_unavailable" }` con status 503 en vez de colgar.

### 3. `src/features/configuracion/services/facturapiCredenciales.ts`
- Agregar traducción del nuevo error `facturapi_sdk_unavailable` → "El servicio de facturación no está disponible temporalmente. Intenta de nuevo en unos minutos."

### 4. CHANGELOG.md + `src/constants/appVersion.ts`
- Bump a `13.141.11`.
- Entrada: "Fix: boot crash de `facturapi-test-conexion` por specifier npm no resoluble. Pinea SDK a versión exacta y agrega resiliencia a fallos de carga."

### 5. Marcar `JAVASCRIPT-REACT-1S` como resuelto en Sentry tras el deploy.

## Verificación post-deploy
- `supabase--edge_function_logs` de `facturapi-test-conexion`: ya no debe aparecer "Could not find constraint".
- Probar conexión desde `/configuracion`: debe responder en < 5s con resultado real (sandbox o live).
- Sentry: el issue no debe regresar en 1h.

## Notas
- Mantengo el SDK oficial (preferencia explícita previa del usuario, `mem://`).
- No toco `package.json` del frontend ni otras edge functions de FacturApi (ya cargan el SDK dinámicamente sólo cuando se invocan).
