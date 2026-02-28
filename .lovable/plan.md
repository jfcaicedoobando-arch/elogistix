

# Módulo de Usuarios con Login y Roles

## Resumen
Implementar autenticación con Supabase Auth (Lovable Cloud), página de login, gestión de usuarios con 3 roles (admin, operador, viewer), y protección de rutas.

## Paso 1: Habilitar Lovable Cloud
- Activar Supabase via Lovable Cloud para auth y base de datos.

## Paso 2: Base de datos — Tabla de roles
Migración SQL:
```sql
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operador', 'viewer');

-- Tabla de roles (separada de auth.users)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función security definer para verificar roles (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Políticas RLS: admins ven todo, usuarios ven su propio rol
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

## Paso 3: Página de Login — `src/pages/Login.tsx`
- Formulario de email + contraseña con `supabase.auth.signInWithPassword()`
- Redirección a `/` tras login exitoso
- Diseño limpio con logo de Elogistix

## Paso 4: Auth Context — `src/contexts/AuthContext.tsx`
- Provider con `onAuthStateChange` + `getSession`
- Exponer `user`, `role`, `signOut`, `loading`
- Consultar `user_roles` para obtener el rol activo del usuario

## Paso 5: Protección de rutas — `src/components/ProtectedRoute.tsx`
- Wrapper que redirige a `/login` si no hay sesión
- Opcionalmente recibe `allowedRoles` para restringir acceso por rol

## Paso 6: Página de Gestión de Usuarios — `src/pages/Usuarios.tsx`
- Tabla con lista de usuarios (email, rol, fecha de registro)
- Botón para invitar usuario nuevo (signup con `supabase.auth.admin` o formulario de registro)
- Selector para cambiar rol de usuario existente
- Solo accesible para rol `admin`

## Paso 7: Integración en Layout
- Agregar ruta `/login` fuera del `<Layout />` (sin sidebar)
- Agregar ruta `/usuarios` dentro del Layout, protegida con rol admin
- Agregar "Usuarios" al sidebar con icono `Users` (renombrar el actual "Clientes" a `UserCheck` o similar para diferenciar)
- Envolver `<App />` con `<AuthProvider>`
- Mostrar botón de logout en el sidebar footer con el email del usuario

## Paso 8: Changelog
- Agregar entrada `v1.4.0` (minor): "Módulo de usuarios con login, roles (admin/operador/viewer) y gestión de accesos"

## Detalles técnicos
- Roles en tabla separada `user_roles`, nunca en profiles ni auth.users
- Función `has_role()` con SECURITY DEFINER para evitar recursión en RLS
- Primer usuario registrado deberá recibir rol `admin` manualmente (vía insert en Supabase) o con trigger automático para el primer usuario

