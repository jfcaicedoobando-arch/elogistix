## Diagnóstico

El botón "Marcar revisado" parece no hacer nada porque la mutación aborta antes de llegar a Supabase con `throw new Error("Sesión no válida")`. El log confirma:

```
[useMarcarRevisado] error: Error: Sesión no válida
  at mutationFn (useAuditoriaRevisiones.ts:45:30)
```

Causas combinadas:

1. **Carrera en `useAuthSession`**: el listener `onAuthStateChange` recibe `INITIAL_SESSION` y lo trata como refresh silencioso (`handleSilentRefresh`), que **solo actualiza `session` y nunca `user`**. El `user` queda hidratado por la promesa paralela `supabase.auth.getSession()`, lo que abre una ventana donde el contexto puede tener `session != null` pero `user == null`.
2. **Validación frágil en las mutaciones**: `useMarcarRevisado`, `useDesmarcarRevisado` y `useAsignarResponsable` confían 100% en `user` del contexto. Si está `null` por la carrera de arriba — o por una invalidación transitoria — abortan sin caer a la fuente de verdad (`supabase.auth.getUser()`).

## Cambios propuestos

### 1. `src/contexts/auth/useAuthSession.ts` — hidratar `user` en INITIAL_SESSION

`INITIAL_SESSION` es el evento canónico de arranque; debe poblar `user` y bajar `loading` igual que `getSession()`. Separar la rama de "token refresh silencioso" (que sí debe seguir evitando re-renders) de la rama de "primera sesión conocida".

```ts
if (eventoAuth === "TOKEN_REFRESHED") {
  handleSilentRefresh(newSession);
  return;
}
// INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, USER_UPDATED → hidratan user+session
setSession(newSession);
setUser(newSession?.user ?? null);
setLoading(false);
if (eventoAuth === "SIGNED_IN" || eventoAuth === "SIGNED_OUT" || eventoAuth === "USER_UPDATED") {
  setLastEvent(eventoAuth);
}
```

El fallback `getSession().then(...)` se mantiene como red de seguridad (no daña, deduplicado por shallow compare opcional).

### 2. `src/hooks/auditoria/useAuditoriaRevisiones.ts` — fallback a `supabase.auth.getUser()`

En las 3 mutaciones (`useMarcarRevisado`, `useDesmarcarRevisado`, `useAsignarResponsable`), reemplazar el guard estricto por un helper que primero intenta `user` del contexto y, si está null, consulta `supabase.auth.getUser()`. Solo si **ambos** fallan, lanzar `"Sesión no válida"`. Esto elimina la dependencia del estado de React para una decisión que ya es asíncrona.

```ts
async function resolveAuthUser(ctxUser: User | null) {
  if (ctxUser) return ctxUser;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sesión no válida");
  return data.user;
}
```

Las 3 mutationFn cambian `if (!user) throw ...` por `const u = await resolveAuthUser(user)` y usan `u.id` / `u.email` para `revisado_por`, `asignado_por`, bitácora, etc.

### 3. Verificación

- Recargar `/auditoria`, abrir el diálogo y hacer clic en "Marcar revisado" antes de que el contexto termine de hidratarse → debe persistir y cerrar el diálogo.
- Vitest: `bunx vitest run` debe seguir en 406/406 (no hay tests específicos de estas mutaciones; los de auditoría existentes no tocan auth context).

### 4. Changelog

- `APP_VERSION` → `10.2.2` (patch).
- Entrada en `chunk0.ts` + `recentChangelog` describiendo el fix de carrera de hidratación y el fallback `getUser()`.

## Lo que NO se hace

- No se cambia la lógica de revisiones, bitácora ni RLS — el problema es exclusivamente del guard cliente.
- No se toca `useAuthProfile` ni `AuthContext` (solo `useAuthSession`).
- No se introducen nuevas dependencias.
