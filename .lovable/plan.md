

# Portal de Clientes + Links de Tracking Públicos

## Resumen

Construir un portal donde los clientes de la plataforma puedan iniciar sesión y ver el estado de sus embarques, documentos, cotizaciones y facturas. Adicionalmente, permitir compartir links de tracking públicos por embarque individual sin necesidad de cuenta.

---

## Arquitectura

```text
Acceso al portal:
┌─────────────────────────────────────────────────┐
│  /portal/login     → Login exclusivo clientes   │
│  /portal           → Dashboard del cliente      │
│  /portal/embarques/:id → Detalle embarque       │
│  /portal/cotizaciones  → Lista cotizaciones     │
│  /portal/facturas      → Lista facturas         │
│                                                 │
│  /tracking/:token  → Link público (sin login)   │
└─────────────────────────────────────────────────┘

Roles:
  app_role existente (admin, operador, viewer, super_admin)
  + nuevo: "cliente"

Aislamiento:
  El rol "cliente" se vincula a un cliente_id.
  Las RLS filtran por ese vínculo.
```

---

## Paso 1 — Base de datos

### 1a. Agregar rol `cliente` al enum `app_role`
```sql
ALTER TYPE public.app_role ADD VALUE 'cliente';
```

### 1b. Crear tabla `client_users` (vínculo usuario ↔ cliente)
```sql
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cliente_id)
);
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
```

Políticas RLS:
- Los admins/operadores de la org pueden gestionar registros de su org.
- El propio usuario puede leer su registro.

### 1c. Crear función `current_user_client_ids()`
```sql
CREATE OR REPLACE FUNCTION public.current_user_client_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cliente_id FROM public.client_users WHERE user_id = auth.uid();
$$;
```

### 1d. Agregar políticas RLS de lectura para rol `cliente`

En las tablas `embarques`, `documentos_embarque`, `eventos_embarque`, `cotizaciones`, `facturas`:
```sql
-- Ejemplo para embarques:
CREATE POLICY "Cliente read own embarques" ON public.embarques
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente') AND
  cliente_id IN (SELECT current_user_client_ids())
);
```
Patrón idéntico para las demás tablas, filtrando por `cliente_id` o por `embarque_id` vinculado al cliente.

### 1e. Crear tabla `tracking_links` (links públicos)
```sql
CREATE TABLE public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  embarque_id uuid NOT NULL,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;
```

### 1f. Edge function `tracking-public`
Recibe el token, valida expiración, retorna datos del embarque y eventos sin requerir autenticación. Usa service_role internamente para leer datos.

---

## Paso 2 — Autenticación del cliente

### 2a. Flujo de invitación (desde el panel interno)
- En `ClienteDetalle.tsx`, agregar botón "Invitar al Portal".
- Abre un diálogo donde el admin ingresa email del contacto del cliente.
- Llama a una edge function `invite-client-user` que:
  1. Crea el usuario en `auth.users` (o busca existente).
  2. Asigna rol `cliente` en `user_roles`.
  3. Crea registro en `client_users` vinculando al `cliente_id`.
  4. Envía email de invitación con link al portal.

### 2b. Página de login `/portal/login`
- Página separada con branding, solo email+contraseña.
- Al autenticarse, verifica que el usuario tenga rol `cliente` y redirige a `/portal`.

### 2c. Modificar `ProtectedRoute` y `AuthContext`
- `AuthContext`: detectar si el usuario es `cliente` y cargar `client_users` para obtener `cliente_id`.
- `ProtectedRoute`: si es `cliente` intentando acceder a rutas internas → redirigir a `/portal`. Si es usuario interno intentando acceder a `/portal` → redirigir a `/`.
- Nuevo componente `PortalProtectedRoute` que valida rol `cliente`.

---

## Paso 3 — Portal del cliente (UI)

### 3a. Layout del portal
- `src/components/portal/PortalLayout.tsx` — Layout simplificado con header (logo + nombre del cliente + cerrar sesión) y navegación lateral mínima.

### 3b. Páginas del portal

| Ruta | Componente | Funcionalidad |
|------|-----------|---------------|
| `/portal` | `PortalDashboard` | Resumen: embarques activos, próximos arribos, facturas pendientes |
| `/portal/embarques` | `PortalEmbarques` | Lista de embarques del cliente con estado visual |
| `/portal/embarques/:id` | `PortalEmbarqueDetalle` | Detalle read-only: resumen, tracking timeline, documentos descargables |
| `/portal/cotizaciones` | `PortalCotizaciones` | Lista de cotizaciones con estado y montos |
| `/portal/cotizaciones/:id` | `PortalCotizacionDetalle` | Detalle read-only de la cotización |
| `/portal/facturas` | `PortalFacturas` | Lista de facturas con estado de pago |

### 3c. Componentes reutilizados
- Reutilizar `TabTracking` en modo read-only (sin formulario de crear evento).
- Reutilizar `TabDocumentos` en modo read-only (solo botón descargar, sin subir/eliminar).
- Reutilizar `DataTable`, `Badge`, `PaginationControls`.

---

## Paso 4 — Links de tracking públicos

### 4a. Generación del link
- En `EmbarqueDetalle.tsx`, agregar botón "Compartir Tracking".
- Llama a `supabase.from('tracking_links').insert(...)` y genera URL: `https://{domain}/tracking/{token}`.
- Copiar al portapapeles con toast de confirmación.
- Opción de configurar expiración (7, 15, 30 días o sin expiración).

### 4b. Página pública `/tracking/:token`
- `src/pages/TrackingPublico.tsx` — No requiere login.
- Llama a la edge function `tracking-public` con el token.
- Muestra: expediente, estado visual, ruta (origen → destino), timeline de eventos, ETA.
- Diseño limpio con branding de la organización.
- Si el token expiró o no existe: mensaje de error amigable.

### 4c. Ruta en `App.tsx`
```tsx
<Route path="/tracking/:token" element={<TrackingPublico />} />
```
Sin `ProtectedRoute`, es pública.

---

## Paso 5 — Integración con panel interno

### 5a. Gestión de accesos en `ClienteDetalle.tsx`
- Nueva pestaña "Portal" que muestra:
  - Usuarios del portal vinculados al cliente (email, fecha de creación).
  - Botón para invitar nuevo usuario.
  - Botón para revocar acceso (elimina registro de `client_users`).

### 5b. Links de tracking activos en `EmbarqueDetalle.tsx`
- Mostrar lista de links activos con fecha de creación y expiración.
- Botón para revocar/eliminar un link.

---

## Paso 6 — Seguridad

- El rol `cliente` solo tiene políticas SELECT en las tablas relevantes.
- Las políticas filtran siempre por `cliente_id IN (SELECT current_user_client_ids())`.
- Los links de tracking usan una edge function con service_role, validando el token server-side. No se expone el embarque_id en la URL.
- La descarga de documentos para clientes se valida server-side: solo documentos de embarques vinculados a su `cliente_id`.
- Nunca se exponen datos financieros internos (costos, profit) al portal del cliente. Solo venta y facturación.

---

## Paso 7 — Changelog

Actualizar `Changelog.tsx` con versión **7.6.0** documentando el portal de clientes y los links de tracking público.

---

## Archivos nuevos estimados

| Archivo | Propósito |
|---------|-----------|
| `src/components/portal/PortalLayout.tsx` | Layout del portal |
| `src/components/portal/PortalSidebar.tsx` | Navegación lateral |
| `src/pages/portal/PortalDashboard.tsx` | Dashboard del cliente |
| `src/pages/portal/PortalEmbarques.tsx` | Lista de embarques |
| `src/pages/portal/PortalEmbarqueDetalle.tsx` | Detalle de embarque |
| `src/pages/portal/PortalCotizaciones.tsx` | Lista de cotizaciones |
| `src/pages/portal/PortalCotizacionDetalle.tsx` | Detalle de cotización |
| `src/pages/portal/PortalFacturas.tsx` | Lista de facturas |
| `src/pages/portal/PortalLogin.tsx` | Login del portal |
| `src/pages/TrackingPublico.tsx` | Página pública de tracking |
| `src/hooks/usePortalData.ts` | Queries del portal |
| `src/hooks/useTrackingLinks.ts` | CRUD de links de tracking |
| `supabase/functions/tracking-public/index.ts` | Edge function pública |
| `supabase/functions/invite-client-user/index.ts` | Edge function de invitación |

## Orden de implementación

1. Migraciones de base de datos (enum, tablas, funciones, RLS)
2. Edge functions (tracking-public, invite-client-user)
3. AuthContext y routing (detectar rol cliente, ProtectedRoute)
4. Portal Login
5. Portal Layout + Dashboard
6. Páginas del portal (embarques, cotizaciones, facturas)
7. Links de tracking público
8. Integración en panel interno (invitar, gestionar accesos)
9. Changelog

