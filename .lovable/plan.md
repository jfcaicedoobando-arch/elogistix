

## Fix: Registrar solo logins reales en la bitácora (v4.33.1)

### Causa raíz

`onAuthStateChange` con evento `SIGNED_IN` se dispara en token refresh y page load, no solo en login real. Esto genera ~2,000 registros falsos de login.

### Solución

En `AuthContext.tsx`, usar un `useRef` para trackear si el login ya fue registrado en esta sesión. Solo registrar cuando:
1. El evento es `SIGNED_IN`
2. No se ha registrado previamente en esta sesión del componente
3. Resetear el ref en `signOut`

Esto evita duplicados por token refresh y page reload.

### Archivos a modificar (2)

1. **`src/contexts/AuthContext.tsx`**
   - Agregar `const hasLoggedLogin = useRef(false)`
   - En el handler de `SIGNED_IN`, verificar `!hasLoggedLogin.current` antes de registrar
   - Setear `hasLoggedLogin.current = true` después de registrar
   - En `signOut`, resetear `hasLoggedLogin.current = false`

2. **`src/pages/Changelog.tsx`** — entrada v4.33.1

### Limpieza de datos existentes (opcional)

Se puede ejecutar un query para limpiar los logins duplicados, conservando solo el primero de cada sesión por usuario por día. Esto se puede coordinar después si lo deseas.

