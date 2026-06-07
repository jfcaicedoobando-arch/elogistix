# Fix: `vi.mock` hoisting bug en `useLoginAudit.test.ts`

## Diagnóstico
Encontramos el archivo culpable: `src/contexts/auth/__tests__/useLoginAudit.test.ts`.

El error real es:
```
ReferenceError: Cannot access 'mockSession' before initialization
```

Vitest **hoistea** las llamadas `vi.mock(...)` al tope del archivo (antes de cualquier otra declaración). Las variables `mockInsert` (línea 4) y `mockSession` (línea 5) están declaradas con `const`, pero los `vi.mock(...)` de las líneas 7-11 las referencian. Al hoistear, los `vi.mock` ejecutan antes de las `const`, disparando el TDZ.

## Solución
Usar `vi.hoisted(() => ...)` para que las variables se inicialicen **junto con** los `vi.mock` (también hoisteados). Este es el patrón oficial de Vitest documentado para este caso.

### Cambio en `src/contexts/auth/__tests__/useLoginAudit.test.ts`

Reemplazar las declaraciones top-level por:
```ts
const { mockInsert, mockSession } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSession: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() },
}));
```

El resto del archivo (los `vi.mock`, `describe`, `it`) queda igual — siguen referenciando `mockInsert` y `mockSession` con el mismo nombre.

## Por qué no se vio antes con 4 shards
Probablemente en shard 3/4 este archivo compartía partición con tests que tenían fake-timers globales o algún teardown que causaba que el error propagara como hang en lugar de fallo limpio (el `setTimeout` interno de Vitest reportando el error podría haberse quedado en `vi.useFakeTimers()`). Con 16 shards quedó aislado y reportó el fallo real en 10s.

## Archivos modificados
- `src/contexts/auth/__tests__/useLoginAudit.test.ts`
- `CHANGELOG.md` + `src/constants/appVersion.ts` (bump)

## No tocar (por ahora)
La matriz de 16 shards se queda — fue útil para encontrar este bug y no daña nada. Si quieres después la podemos bajar a 4 una vez que CI vuelva a verde sostenido.