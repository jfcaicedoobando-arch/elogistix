## Problema

`audit:tests` falla por título duplicado:
- `eliminar-embarque-bloqueado-fiscal.test.ts:111` (Fase E)
- `grafo-transiciones-embarque-fase-g.test.ts:114` (Fase G)

Ambos usan `it("otorga EXECUTE sólo a authenticated y service_role", ...)`.

## Fix

Renombrar el título en el test de Fase G para reflejar el contexto (son 2 funciones distintas: `transicion_embarque_valida` y `assert_transicion_embarque`), dejando Fase E intacto.

**Edición única** en `src/lib/__tests__/grafo-transiciones-embarque-fase-g.test.ts:114`:

```ts
it("otorga EXECUTE de las funciones de transición sólo a authenticated y service_role", () => {
```

## Verificación

`bun run audit:tests` → 0 violaciones.
