## Diagnóstico

El CI falló en el paso **"Merge reports + coverage thresholds"** con:

```
ERROR: Coverage for lines     (35.95%) < 38%
ERROR: Coverage for functions (26.69%) < 30%
ERROR: Coverage for statements(35.79%) < 38%
ERROR: Coverage for branches  (30.59%) < 34%
```

La caída se debe a los archivos nuevos/modificados sin tests: `useEmailsOcultos.ts`, `useDestinatariosSugeridos.ts` y `EnviarProformaDialog.tsx` (feature de correos ocultos + memoria de destinatarios). Regla del proyecto: **jamás bajar los umbrales en `vitest.config.ts`** — hay que escribir tests del código nuevo.

## Tests a agregar

1. **`src/features/proformas/hooks/__tests__/useEmailsOcultos.test.ts`** — cobertura de todas las ramas:
   - Estado inicial vacío cuando no hay `clienteId` o storage vacío.
   - `ocultar` agrega email (normalizado a lowercase) y persiste.
   - `ocultar` deduplica (no agrega dos veces el mismo email).
   - `ocultar` con string vacío no hace nada.
   - `restaurar` remueve un email específico.
   - `restaurarVarios` remueve un conjunto.
   - `restaurarTodos` deja la lista vacía.
   - `isOculto` es case-insensitive.
   - Cambio de `clienteId` recarga desde storage la lista de ese cliente.
   - Storage con JSON inválido → lista vacía sin crash.
   - Storage con array que contiene no-strings → filtra sólo strings.
   - Sin `clienteId` → `ocultar` no persiste nada.

2. **`src/features/proformas/hooks/__tests__/useDestinatariosSugeridos.test.ts`** — cubre el fetch y las funciones puras `extraerEmails` / `normalizar`:
   - Extrae emails desde formato `[{email:"a@b.com"}]` y `["a@b.com"]`.
   - Dedup case-insensitive y filtra emails inválidos.
   - Combina `proforma_envios` (destinatarios + cc) con `contactos_cliente`.
   - `ultimo` es `null` cuando no hay envíos previos.
   - `enabled=false` cuando `clienteId` es null/undefined.
   - Mock de `supabase.from(...).select(...).eq(...).order(...).limit(...)` con cadena thenable (patrón del proyecto — `mem://technical/testing-mock-patterns`).

3. **`src/features/proformas/components/__tests__/EnviarProformaDialog.test.tsx`** — smoke test del comportamiento nuevo:
   - Renderiza chips "Recientes" con las sugerencias visibles.
   - Click en ✕ oculta el chip y llama a `sonner.toast` con acción "Deshacer".
   - Enlace "Restaurar ocultos (N)" aparece cuando hay ocultos y los restaura.
   - Click en el chip agrega el email al input "Para".
   - Al enviar exitosamente, los correos usados se reactivan (llamada a `restaurarVarios`).
   - Mocks: `supabase.functions.invoke` (éxito y error), `useDestinatariosSugeridos`, `sonner`.

## Verificación

- Ejecutar localmente `bun run test:coverage` (o el shard afectado) y confirmar que los porcentajes vuelven a superar los umbrales.
- No tocar `vitest.config.ts`.

## Archivos afectados

- `src/features/proformas/hooks/__tests__/useEmailsOcultos.test.ts` (nuevo).
- `src/features/proformas/hooks/__tests__/useDestinatariosSugeridos.test.ts` (nuevo).
- `src/features/proformas/components/__tests__/EnviarProformaDialog.test.tsx` (nuevo).
- `CHANGELOG.md` + `src/constants/appVersion.ts` → bump a `13.145.3`.

## Fuera de alcance

- No se agregan features ni se modifica la lógica ya implementada; solo se cubre con tests.
- Los `console.warn`/`Error:` que aparecen en los logs son ruido esperado de tests existentes (mocks que simulan fallos), no fallos reales del suite.
