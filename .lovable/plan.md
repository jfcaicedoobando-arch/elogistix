

## Plan: Reorganizar sidebar en secciones lógicas con separadores

El sidebar actual tiene dos problemas: el menú principal mezcla 7 items operativos, de referencia y de admin en una sola lista plana sin labels; y items de uso poco frecuente (Changelog, Bitácora) están intercalados con los operativos.

### Cambios en `src/components/AppSidebar.tsx`

**1. Separar los arrays de items en 4 grupos**

```text
dashboardItems  → Principal, Operaciones           (sin cambios)
gestionItems    → Cotizaciones, Embarques, Facturación
directorioItems → Clientes, Proveedores
sistemaItems    → Bitácora, Changelog
adminItems      → Usuarios, Configuración           (sin cambios, solo admin)
```

**2. Renderizar cada grupo como un `SidebarGroup` con label y separador**

```text
┌─────────────────────┐
│ 🔷 Elogistix        │
│    Agente de Carga   │
├───── separator ─────┤
│   DASHBOARDS         │
│   Principal          │
│   Operaciones        │
├───── separator ─────┤
│   GESTIÓN            │
│   Cotizaciones       │
│   Embarques          │
│   Facturación        │
├───── separator ─────┤
│   DIRECTORIO         │
│   Clientes           │
│   Proveedores        │
├───── separator ─────┤
│   SISTEMA            │
│   Bitácora           │
│   Changelog          │
├───── separator ─────┤  ← solo admin
│   ADMINISTRACIÓN     │
│   Usuarios           │
│   Configuración      │
├───── separator ─────┤
│ user@email.com       │
│ Cerrar sesión        │
│ v4.2.0               │
└─────────────────────┘
```

Each group uses the same pattern: a `span` label (hidden when collapsed) + `SidebarMenu` with items + `Separator`. Admin section only renders when `role === "admin"`.

**3. Remove `allItems` concatenation**

Replace the single `allItems.map()` with individual group renders, eliminating the flat list approach.

### Archivo modificado
- `src/components/AppSidebar.tsx` — restructure item arrays and render logic

