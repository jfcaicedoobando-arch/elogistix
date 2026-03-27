

## Plan: Catálogos de Navieras y Tipos de Contenedor

Crear dos tablas en la base de datos (`navieras` y `tipos_contenedor`) siguiendo el mismo patrón que `puertos`, con hooks CRUD, componentes de administración en el tab de Catálogos Globales, y migración de los selects existentes para leer de la BD en lugar de archivos estáticos.

---

### 1. Migración SQL — Crear tablas `navieras` y `tipos_contenedor`

```sql
CREATE TABLE public.navieras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.navieras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden leer navieras" ON public.navieras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin CRUD navieras" ON public.navieras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins CRUD navieras" ON public.navieras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.tipos_contenedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_contenedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden leer tipos_contenedor" ON public.tipos_contenedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin CRUD tipos_contenedor" ON public.tipos_contenedor FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins CRUD tipos_contenedor" ON public.tipos_contenedor FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
```

Seed con datos de `shippingLines.ts` y `containerTypes.ts`.

### 2. Hooks — `useNavieras.ts` y `useTiposContenedor.ts`

Seguir el patrón exacto de `usePuertos.ts`:
- `useNavieras()` — activas, para selects
- `useAllNavieras()` — todas, para admin
- `useAdminNavieras()` — mutations: agregar, toggleActivo, eliminar
- Mismo patrón para `useTiposContenedor`

### 3. Query keys

Agregar a `queryKeys.ts`:
```ts
navieras: { all, activas, todas },
tiposContenedor: { all, activos, todos },
```

### 4. Componentes de catálogo admin

- `TabNavieras.tsx` — Mismo layout que `TabPuertos` (formulario de agregar, búsqueda, DataTable con toggle activo y eliminar). Campos: código, nombre.
- `TabTiposContenedor.tsx` — Igual. Campos: código, nombre.

### 5. Integrar en `TabCatalogosGlobales.tsx`

Reemplazar los placeholders "Próximamente" con los nuevos componentes `TabNavieras` y `TabTiposContenedor`.

### 6. Migrar selects existentes a leer de BD

- **`ShippingLineSelect.tsx`** — Cambiar de `import { shippingLines }` estático a `useNavieras()` hook.
- **`StepDatosRuta.tsx`** — Cambiar de `containerTypes` estático a `useTiposContenedor()` hook.
- **`DialogDuplicarEmbarque.tsx`** — Mismo cambio para tipos de contenedor.

### 7. Changelog

Agregar entrada v6.7.0 — "Catálogos de navieras y tipos de contenedor".

---

### Archivos afectados

| Archivo | Acción |
|---|---|
| Migración SQL | Crear tablas + seed + RLS |
| `src/lib/queryKeys.ts` | Agregar keys |
| `src/hooks/useNavieras.ts` | Crear |
| `src/hooks/useTiposContenedor.ts` | Crear |
| `src/components/configuracion/TabNavieras.tsx` | Crear |
| `src/components/configuracion/TabTiposContenedor.tsx` | Crear |
| `src/components/admin/TabCatalogosGlobales.tsx` | Integrar nuevos tabs |
| `src/components/ShippingLineSelect.tsx` | Migrar a hook |
| `src/components/embarque/StepDatosRuta.tsx` | Migrar a hook |
| `src/components/embarque/DialogDuplicarEmbarque.tsx` | Migrar a hook |
| `src/pages/Changelog.tsx` | Agregar v6.7.0 |

