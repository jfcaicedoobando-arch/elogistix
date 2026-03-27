

## Plan: Configuración Global del Super Admin (v6.3.0)

Desarrollar las 4 secciones de la página de Configuración Global con funcionalidad real, organizadas en tabs, más la capacidad de impersonar la configuración de cada organización.

---

### Estructura de la página

Reemplazar las 3 cards placeholder con un layout de **Tabs** (similar a `/configuracion`):

```text
┌─────────────────────────────────────────────────┐
│  Configuración Global                           │
│  ┌──────┬──────────┬──────────┬─────────────┐   │
│  │Plat. │ Planes   │Seguridad │ Catálogos   │   │
│  └──────┴──────────┴──────────┴─────────────┘   │
│                                                 │
│  [Contenido del tab activo]                     │
│                                                 │
│  ── Configuración por Organización ──           │
│  [Selector de org] → [Ver/Editar config de org] │
└─────────────────────────────────────────────────┘
```

---

### Tab 1: Plataforma

Configuración de identidad de la app. Se guarda en una nueva tabla `configuracion_global` (sin `organization_id`).

**Campos editables:**
- Nombre de la plataforma (ej. "Elogistix")
- Subtítulo / tagline
- URL del logo (texto, futuro: upload)
- Color primario (hex picker)
- Email de soporte
- Versión actual (solo lectura, tomada del Changelog)

### Tab 2: Planes y Límites

Gestión de los planes disponibles para las organizaciones.

**Funcionalidad:**
- Tabla editable con los planes existentes (Basic, Pro, Enterprise)
- Por cada plan: nombre, límite de usuarios, límite de embarques/mes, almacenamiento (MB), precio mensual
- Poder editar estos valores
- Ver qué organizaciones están en cada plan (badge con conteo)

**Tabla nueva:** `planes` con columnas: `id`, `nombre`, `max_usuarios`, `max_embarques_mes`, `almacenamiento_mb`, `precio_mensual`, `activo`, `created_at`

La columna `plan` en `organizations` pasará a referenciar esta tabla (por nombre, para mantener simplicidad).

### Tab 3: Seguridad Global

Configuración de políticas de seguridad que aplican a toda la plataforma.

**Campos:**
- Auto-confirmar emails al registrar (switch, actualmente desactivado)
- Longitud mínima de contraseña (numérico)
- Tiempo de expiración de sesión (horas)
- Intentos máximos de login antes de bloqueo
- Permitir registro público (switch)

Se guardan en `configuracion_global` con categoría `seguridad`.

### Tab 4: Catálogos Globales

Gestión de catálogos compartidos entre todas las organizaciones:

- **Puertos**: Ya existe la tabla `puertos` y su gestión en `TabPuertos`. Reutilizar el componente.
- **Navieras**: Actualmente hardcoded en `src/data/shippingLines.ts`. Migrar a tabla `navieras_catalogo` con gestión CRUD.
- **Tipos de contenedor**: Hardcoded en `src/data/containerTypes.ts`. Migrar a tabla `tipos_contenedor` con gestión CRUD.

Por ahora, integrar solamente Puertos (ya funcional) y dejar Navieras y Tipos de Contenedor como "Próximamente".

### Sección inferior: Config por Organización (Impersonación)

Debajo de los tabs, un selector de organización. Al elegir una, se muestra el mismo formulario de `/configuracion` pero leyendo/escribiendo los datos de esa org específica.

**Implementación:**
- Reutilizar los componentes `TabEmpresa`, `TabTiposCambio`, etc.
- Pasar el `organization_id` seleccionado al hook `useConfiguracion` para filtrar por esa org
- Crear una variante del hook que acepte un `orgId` opcional

---

### Cambios técnicos

| Archivo | Cambio |
|---------|--------|
| **Migración SQL** | Crear tabla `configuracion_global` (sin org_id), tabla `planes`, insertar planes default |
| `src/pages/admin/AdminConfiguracion.tsx` | Reescribir con Tabs y contenido real |
| `src/components/admin/TabPlataforma.tsx` | **Nuevo** — Form de identidad de la app |
| `src/components/admin/TabPlanes.tsx` | **Nuevo** — CRUD de planes |
| `src/components/admin/TabSeguridadGlobal.tsx` | **Nuevo** — Políticas de seguridad |
| `src/components/admin/TabCatalogosGlobales.tsx` | **Nuevo** — Integra TabPuertos + placeholders |
| `src/components/admin/ConfigOrganizacion.tsx` | **Nuevo** — Impersonación de config de org |
| `src/hooks/useConfiguracionGlobal.ts` | **Nuevo** — Hook para `configuracion_global` |
| `src/hooks/usePlanes.ts` | **Nuevo** — Hook CRUD para tabla `planes` |
| `src/hooks/useConfiguracion.ts` | Agregar parámetro opcional `orgId` para impersonación |
| `src/pages/Changelog.tsx` | Entrada v6.3.0 |

### Tabla `configuracion_global`

```sql
CREATE TABLE configuracion_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  clave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}',
  descripcion text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(categoria, clave)
);
-- Solo super_admin puede leer/escribir
```

### Tabla `planes`

```sql
CREATE TABLE planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  max_usuarios int NOT NULL DEFAULT 5,
  max_embarques_mes int NOT NULL DEFAULT 100,
  almacenamiento_mb int NOT NULL DEFAULT 500,
  precio_mensual numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
INSERT INTO planes (nombre, max_usuarios, max_embarques_mes, almacenamiento_mb, precio_mensual)
VALUES ('basic', 5, 100, 500, 0), ('pro', 15, 500, 2000, 999), ('enterprise', 100, 5000, 10000, 4999);
```

