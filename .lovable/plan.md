## Plan

### Objetivo
Pasar `bun run lint -- --max-warnings 0` corrigiendo los dos problemas reportados.

### Problemas actuales
1. `src/features/embarques/hooks/mutations/useEstadoEmbarque.ts:85` — regla `preserve-caught-error`: se lanza un `Error` nuevo sin adjuntar el error original como `cause`.
2. `supabase/functions/facturapi-emitir/index.ts:37` — regla `max-lines-per-function`: la función flecha async del handler tiene 212 líneas (máximo 200).

### Cambios propuestos

#### 1. Preservar `cause` en `useEstadoEmbarque.ts`
- En el bloque `catch` de `useSyncEstadoEmbarque`, cambiar:
  ```ts
  throw new Error("El estado del embarque cambió...");
  ```
  por:
  ```ts
  throw new Error("El estado del embarque cambió...", { cause: err });
  ```
- Eso mantiene la trazabilidad del error original (por ejemplo el `LC_TRANSICION_INVALIDA` del backend) y satisface la regla de lint.

#### 2. Reducir tamaño del handler en `facturapi-emitir/index.ts`
- Extraer secciones independientes del handler en funciones helper privadas dentro del mismo archivo (sin cambiar comportamiento):
  - `claimFactura(supabase, facturaId)` — reclama la fila con `PENDING:<uuid>` y devuelve `{ claimTag, claimAt, release }`.
  - `resolverSustitucion(supabase, factura)` — busca el UUID fiscal de la factura sustituida y devuelve `sustituyeUuid` o error JSON.
  - `cargarContextoFactura(supabase, facturaId, factura, cliente, conceptos)` — construye el `FacturaContext` (referencias de embarque, mapeo de conceptos, etc.).
  - `emitirYActualizar(supabase, facturapi, ctx, factura, body)` — crea la factura en FacturAPI, respalda el XML y actualiza la fila local.
- El handler principal quedará como orquestador: valida request, autentica, carga factura, llama helpers y devuelve respuestas.
- Meta: llevar el handler a menos de 200 líneas de función.

### Verificación
- Ejecutar `bun run lint -- --max-warnings 0` y confirmar 0 errores / 0 warnings.
- Ejecutar `bun run typecheck` (o el comando del proyecto) para asegurar que los nuevos helpers no rompen tipos.
- Si hay tests de facturapi-emitir o de estados de embarque, correrlos.

### Versionado
- Actualizar `src/constants/appVersion.ts` y `CHANGELOG.md` con bump de versión parche (siguiente disponible) y nota breve: "Fix lint: preserve-caught-error + max-lines-per-function en facturapi-emitir".

### Notas para el usuario
- No cambia lógica de negocio; solo es refactor para cumplir con las reglas de calidad de código del proyecto.
- La regla `preserve-caught-error` es importante porque sin `cause` perdemos el error original de Supabase/Postgres en herramientas como Sentry.