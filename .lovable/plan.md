## Problemas detectados

**1. `supabase/functions/facturapi-webhook/helpers.ts` — sintaxis rota**
La función `mapEventToFacturaPatch` no cierra correctamente sus llaves: en la línea 68 hay un `}` que cierra el `switch`, pero falta otro `}` para cerrar la función. Luego aparece `export interface MappedReceiptUpdate` dentro de la función (Deno: *"'import', and 'export' cannot be used outside of module code"*). En la línea 120 hay un `}` extra que cierra una llave inexistente.

Esto rompe **Edge Functions (Deno tests)** porque ningún test del módulo carga.

**2. `src/features/facturacion/hooks/useFacturacionKpisFiscales.ts` viola la capa Hooks → Services**
Importa `@/integrations/supabase/client` directamente. El test de arquitectura `architecture.test.ts` bloquea esto, lo que rompe:
- **Tests (shard 6/8)**
- **Lint, typecheck, unused code & build** (mismo test corre en el job `quality`)
- **Coverage merge & report** y **CI Success** (en cascada)

## Plan de arreglo

### a) Arreglar `facturapi-webhook/helpers.ts`
- Añadir el `}` faltante después de la línea 68 para cerrar `mapEventToFacturaPatch`.
- Eliminar el `}` extra en la línea 120.

### b) Extraer servicio para KPIs fiscales
- Crear `src/features/facturacion/services/kpisFiscales.ts` con:
  - Tipo `FacturacionKpisFiscales`.
  - Función `fetchFacturacionKpisFiscales(orgId)` que hace los 3 conteos en paralelo (proformas convertibles, facturas sin timbrar, REPs pendientes).
- Reescribir `useFacturacionKpisFiscales.ts` para:
  - Quitar el import de `@/integrations/supabase/client`.
  - Llamar al nuevo servicio en `queryFn`.

### c) Versionado
- Bump `APP_VERSION` a `13.137.14`.
- Entrada en `CHANGELOG.md`:
  ```
  ## [13.137.14] - 2026-06-26
  - **fix(ci)**: corrige sintaxis en `facturapi-webhook/helpers.ts` y extrae servicio `kpisFiscales` para cumplir capa Hooks→Services.
  ```

### d) Verificación
- `bun x vitest run src/lib/__tests__/architecture.test.ts` → debe pasar.
- `deno test --no-check supabase/functions/facturapi-webhook/helpers_test.ts` → debe parsear y pasar.

## Notas técnicas (analogía)
Los hooks son como meseros: toman pedidos del componente y los entregan, pero no entran a la cocina (Supabase). El servicio es la cocina. Antes, el hook se metía a cocinar — ahora vuelve a su rol.
El segundo bug es como una receta a la que le faltó cerrar un paréntesis: el chef (Deno) no la pudo leer y abortó todo el menú.
