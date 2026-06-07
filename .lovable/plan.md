# Fix: loop infinito en `useLeadEditForm.test.tsx`

## Diagnóstico
Comparé los archivos del shard 8/16 (`vitest list --shard=8/16`) contra los que el CI alcanzó a completar. Quedaron 4 archivos sin imprimir:

- `useLeadEditForm.test.tsx` ← **culpable**
- `useDashboardEjecutivo.test.tsx`
- `errorCatalog.test.ts`
- `embarquePayloadSchemas.test.ts`

## Causa raíz
El test invoca el factory `lead()` **dentro** del closure de `renderHook`:

```ts
const lead = () => ({ empresa: "ACME S.A.", ... });
renderHook(() => useLeadEditForm(lead()));   // ⚠ lead() nuevo en cada render
```

Cada render produce un objeto `lead` **con nueva referencia**. Dentro de `useLeadEditForm`:

```ts
useEffect(() => {
  setForm({ empresa: lead.empresa ?? "", ... });   // siempre objeto nuevo
}, [lead]);   // dispara cada render porque lead cambia de referencia
```

→ `setForm` con objeto nuevo → re-render → `lead()` nuevo → effect dispara → `setForm` otra vez → **loop infinito**.

No falla con "Maximum update depth" porque React 18 + RTL ejecutan los updates vía microtasks, saturando el event loop sin tirar el límite síncrono → el proceso del fork se queda spinning hasta que GitHub mata el job por timeout.

## Solución
Estabilizar la referencia del lead en los 3 tests del archivo. Pasar la referencia una sola vez:

```ts
it("inicializa form con valores del lead", () => {
  const inicial = lead();
  const { result } = renderHook(() => useLeadEditForm(inicial));
  // ...
});
```

Mismo patrón en los otros 2 tests. El factory `lead()` se invoca una sola vez por test, y la referencia se mantiene estable entre re-renders.

## Bonus: evitar que vuelva a pasar
El hook tiene una susceptibilidad real (recordable solo a desarrolladores). En el código de producción `lead` llega de React Query y mantiene referencia estable mientras no haya refetch, así que no se ha disparado en runtime. No tocamos el hook — solo el test, que es donde se rompía la invariante.

## Archivos modificados
- `src/hooks/crm/__tests__/useLeadEditForm.test.tsx`
- `CHANGELOG.md` + `src/constants/appVersion.ts` (bump)