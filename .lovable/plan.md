

## Plan: Enriquecer página de detalle de organización

La página `AdminOrgDetalle` ya existe y es navegable desde la lista de organizaciones, pero solo muestra los miembros. Se enriquecerá con información completa.

---

### Cambios en `src/pages/admin/AdminOrgDetalle.tsx`

Rediseñar la página para incluir:

1. **Header con botón de regreso** — Botón "← Organizaciones" para volver a la lista.

2. **Card de información general** — Nombre, RFC, plan (badge), estado (activo/inactivo), fecha de creación, logo_url si existe.

3. **Estadísticas rápidas (KPIs)** — Contadores obtenidos con queries:
   - Total de miembros (count de `organization_members`)
   - Total de embarques (count de `embarques` filtrado por `organization_id`)
   - Total de clientes (count de `clientes` filtrado por `organization_id`)
   - Total de cotizaciones (count de `cotizaciones` filtrado por `organization_id`)

4. **Tabla de miembros** — Ya existente, se mantiene con la funcionalidad de cambio de rol.

5. **Card de configuración** — Mostrar items de `configuracion` filtrados por `organization_id` (reutilizando lógica de `useConfiguracionByOrg`).

### Cambios en `src/pages/Changelog.tsx`

Agregar entrada para esta mejora.

---

### Detalle técnico

- Se agregan 4 queries con `supabase.from("tabla").select("id", { count: "exact", head: true }).eq("organization_id", id)` para obtener los conteos sin traer datos.
- Se usa el hook `useConfiguracionByOrg` existente para la sección de configuración.
- Layout: header → stats grid (4 columnas) → card info + miembros en stack vertical → config al final.

