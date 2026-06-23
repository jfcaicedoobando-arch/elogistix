# Reubicar `agente.demo@librecarga.com` a Elogistix

## Diagnóstico (analogía)
Imagina que el usuario tiene dos credenciales colgadas al cuello: una de "empleado interno con llave maestra" (membresía admin en *Mi organización*) y otra de "agente externo de Elogistix". La app revisa la credencial interna primero, por eso entra al dashboard completo en vez de al portal del agente.

Vamos a quitarle la credencial interna, dejarle solo la de Elogistix, y además poner un guardia en la puerta para que aunque tenga otra credencial en el futuro, siempre lo manden al portal del agente.

## Cambios

### 1. Migración SQL (datos)
- Borrar la membresía admin en *Mi organización* (`organization_members` user_id=fde67321… / org=7688c69a…).
- Borrar la organización huérfana *Mi organización* (es el único miembro, se creó por el trigger `handle_new_user_signup` al registrarse).
- Insertar membresía en **Elogistix** (`00000000-0000-0000-0000-000000000001`) con rol `viewer` para que el `orgRole` sea consistente con el portal externo (no admin).
- Verificar/asegurar `agente_users` ya apunta a Elogistix (ya está, no se toca).

### 2. Guardia en el frontend (`src/features/auth/components/ProtectedRoute.tsx`)
Agregar redirección defensiva al inicio del componente:

```tsx
if (role === "agente_carga" && !location.pathname.startsWith("/agente")) {
  return <Navigate to="/agente" replace />;
}
```

Esto evita que cualquier usuario con rol global `agente_carga` (presente o futuro) entre al área interna aunque por error tenga membresía en otra org.

### 3. Versionado
- Bump `APP_VERSION` → `13.130.2`.
- Entrada en `CHANGELOG.md`:
  - Reubicación de `agente.demo` a Elogistix y limpieza de organización huérfana.
  - Guardia de ruta para rol `agente_carga` (siempre redirige a `/agente`).

## Fuera de alcance
- No tocar `handle_new_user_signup` (eso requiere una decisión más amplia sobre cómo se crean orgs al registrarse agentes — lo dejamos para otro turno si lo pides).
- No cambia RLS ni edge functions.
