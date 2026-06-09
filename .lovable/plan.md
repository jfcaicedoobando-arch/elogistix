# Plan: Rediseño del Directorio de Proveedores

## 1. Hallazgos de la auditoría

### 1.1 UX confusa por exceso de filtros simultáneos
- Hoy conviven **tres ejes de filtrado** en una sola pantalla: 10 pestañas por `tipo` + segmentado `Nacional/Extranjero/Todos` + búsqueda. Esto obliga al usuario a "adivinar" en qué pestaña está el proveedor que busca.
- Las 10 pestañas (Navieras, Aerolíneas, Transportistas, Agentes Aduanales, Agentes de Carga, Aseguradoras, Custodia, Almacenes, Acondicionamiento, Mat. Peligrosos) son **excluyentes**: si el proveedor no encaja en una de esas 10 categorías logísticas, no tiene dónde vivir.
- La búsqueda solo aplica **dentro de la pestaña activa** (`tipo` se manda al RPC). Un usuario que busca "Maersk" estando en la pestaña "Transportistas" ve "0 resultados" aunque exista en "Navieras". Esta es la causa real de la queja "los filtros no funcionan".

### 1.2 El combo Naviera/Todos sí mezcla — la percepción nace de otro bug
- Verificación en BD: tab Navieras con `origen=todos` devuelve 7 Nacional + 8 Extranjero = 15 (correcto en el RPC `fetch_proveedores_paginados`).
- La confusión proviene de:
  - **No hay `resetPage` cuando cambia el `tipo`** en `ProveedorTable.tsx`. Al cambiar de pestaña conservando page > 0, se ven "menos" registros o vacío.
  - El segmentado `Nacional/Extranjero/Todos` está **fuera** de las pestañas, así que al cambiar de tab parece "que no aplicó" porque su estado no se reinicia visualmente.
  - No hay contadores por pestaña ni chip de filtros activos, así que el usuario no sabe por qué la lista se vacía.

### 1.3 Catálogo cerrado a operación logística
- `tipo_proveedor` es un enum PostgreSQL con solo 10 valores logísticos. **No existe** forma de registrar: arrendador, papelería, internet/telefonía, software/SaaS, mantenimiento, honorarios, servicios públicos, marketing, viáticos, etc.
- Esto bloquea el objetivo declarado: "llevar todos los gastos de la empresa al ERP". Hoy CxP, facturas de proveedor y pagos solo pueden ligarse a proveedores logísticos.

### 1.4 Otros puntos menores
- Plantilla CSV de importación está atada al `tipo` de la pestaña activa (confuso al importar mezclado).
- `ProveedorOperacionesTable.tsx` existe pero no se usa desde `Proveedores.tsx` (código muerto a revisar).

## 2. Diseño propuesto

### 2.1 Mejor práctica: clasificación en dos dimensiones
Separar conceptualmente lo que hoy está mezclado en un solo enum:

```text
Proveedor
├── categoria  (¿para qué se usa el gasto?)   ← NUEVO
│   ├── Operación logística
│   │   └── subtipo: Naviera | Aerolínea | Transportista | …
│   └── Gasto operativo / Administrativo
│       └── subtipo: Renta | Servicios (luz/agua/internet) |
│                    Papelería | Software/SaaS | Honorarios |
│                    Mantenimiento | Marketing | Viáticos | Otros
└── origen     (Nacional | Extranjero)        ← ya existe
```

Ventajas: la pestaña principal es la **categoría** (2-3 tabs), el subtipo pasa a ser un select dentro de la lista, y el módulo queda preparado para todos los gastos del ERP sin tocar el resto del sistema (CxP, facturas, pagos siguen apuntando a `proveedores.id`).

### 2.2 Nueva pantalla `/proveedores`

```text
┌──────────────────────────────────────────────────────────────┐
│ Proveedores                          [Importar CSV] [+ Nuevo]│
├──────────────────────────────────────────────────────────────┤
│ [ Todos ] [ Logísticos ] [ Gastos operativos ]   ← 3 tabs    │
├──────────────────────────────────────────────────────────────┤
│ 🔎 Buscar (nombre, RFC, contacto)…  Búsqueda GLOBAL          │
│                                                              │
│ Filtros: [Subtipo ▾]  [Origen ▾]  [Moneda ▾]   [Limpiar]    │
│ Chips activos: Subtipo: Naviera ✕  Origen: Nacional ✕        │
├──────────────────────────────────────────────────────────────┤
│ Tabla con columnas: Nombre · Subtipo · RFC/Tax ID · Origen · │
│ Moneda · Operaciones · Pendiente · Acciones                  │
└──────────────────────────────────────────────────────────────┘
```

Reglas:
- La **búsqueda es global** (ya no se filtra por subtipo automáticamente). Esto elimina la queja principal.
- Los selects (`Subtipo`, `Origen`, `Moneda`) son **opcionales** y se muestran como chips removibles.
- La tabla agrega la columna `Subtipo` para que el usuario entienda de un vistazo a qué categoría pertenece cada registro.
- Contadores por tab: `Logísticos (24)`, `Gastos operativos (8)`.

### 2.3 Eliminaciones / consolidaciones
- Se eliminan las 10 pestañas por subtipo (se reemplazan por un select).
- Se elimina el segmentado Nacional/Extranjero/Todos como control independiente (pasa al área de filtros).
- Se quita el código muerto `ProveedorOperacionesTable.tsx` si confirmamos que no se usa.

### 2.4 Diálogo Nuevo/Editar Proveedor
- Primer paso obligatorio: `Categoría` (Logístico | Gasto operativo).
- Segundo paso: `Subtipo` según categoría (enum dinámico por categoría).
- El bloque de país / Tax ID solo aparece para Logísticos (los gastos operativos casi siempre son Nacionales con RFC mexicano; conserva la posibilidad de marcar Extranjero para SaaS internacional como AWS, GitHub, etc.).

## 3. Detalles técnicos

### 3.1 Migración de BD (en orden)
1. Crear nuevo enum `categoria_proveedor` con valores `Logistico`, `GastoOperativo`.
2. Crear nuevo enum `subtipo_gasto_operativo` (Renta, Servicios, Papelería, SaaS, Honorarios, Mantenimiento, Marketing, Viáticos, Otros).
3. `ALTER TABLE proveedores ADD COLUMN categoria categoria_proveedor NOT NULL DEFAULT 'Logistico'`.
4. `ALTER TABLE proveedores ADD COLUMN subtipo_gasto subtipo_gasto_operativo NULL` (solo poblado cuando `categoria='GastoOperativo'`).
5. Hacer `tipo` nullable cuando `categoria='GastoOperativo'`, o conservar requerido solo para Logísticos vía CHECK constraint.
6. Backfill: todos los registros existentes → `categoria='Logistico'` (ya es el default).
7. Actualizar RPC `fetch_proveedores_paginados` para aceptar `p_categoria`, `p_subtipo_gasto`, y que `p_search` sea global (sin requerir tipo).
8. RLS: las políticas actuales (`organization_id`) ya cubren las nuevas filas; no se modifican.

### 3.2 Cambios de código
- `src/pages/proveedores/Proveedores.tsx` — reescribir según wireframe 2.2.
- `src/pages/proveedores/ProveedorTable.tsx` — añadir columna Subtipo; agregar `resetPage` cuando cambia cualquier filtro (no solo search/origen).
- `src/pages/proveedores/proveedorTableColumns.tsx` — agregar columna Subtipo y formateo.
- `src/services/proveedor/index.ts` — extender `fetchProveedoresPaginados` con `categoria`, `subtipo_gasto`.
- `src/hooks/proveedor/useProveedores.ts` — pasar nuevos filtros y reconstruir queryKey.
- `src/hooks/proveedor/useNuevoProveedorController.ts` y `useEditarProveedorController.ts` — agregar lógica de categoría/subtipo, ajustar validaciones (Tax ID, país solo si Logístico+Extranjero).
- `src/components/proveedor/NuevoProveedorDialog.tsx` y `EditarProveedorDialog.tsx` — UI de dos pasos.
- `src/lib/csv/importSchemas.ts` — agregar columnas `categoria` y `subtipo_gasto` a la plantilla.
- Borrar `ProveedorOperacionesTable.tsx` si no tiene consumidores.
- Aplicar las 10 reglas Power of 10 (componentes ≤200 líneas, sin `any`, manejar `error` de Supabase).

### 3.3 Compatibilidad con CxP / facturas / pagos
Cero cambios en `cxp`, `facturas`, `pagos_proveedor`, `comisiones_devengadas`: siguen apuntando a `proveedores.id`. Solo se amplía el universo de proveedores posibles, lo que abre la puerta a registrar facturas de renta, internet, SaaS, etc., sin tocar esos módulos.

### 3.4 Versionado y bitácora
- `APP_VERSION` → bump menor (p.ej. `12.65.0`) por ser cambio funcional.
- Entrada en `CHANGELOG.md` (root) describiendo: rediseño de filtros, búsqueda global, nuevas categorías Logístico/Gasto operativo, migración de BD.

## 4. Entregables por fase

1. **Fase 1 – BD + tipos**: migración con enums, columnas, RPC actualizado, GRANTs verificados.
2. **Fase 2 – Backend client**: services, hooks, validaciones.
3. **Fase 3 – UI**: nueva pantalla, diálogo de 2 pasos, importación CSV ampliada.
4. **Fase 4 – Limpieza**: eliminar código muerto, tests de hooks `useNuevoProveedorController` / `useEditarProveedorController`, ajustar audit.

## 5. Fuera de alcance
- Migrar facturas históricas a las nuevas categorías de gasto (los usuarios lo harán manualmente conforme registren gastos nuevos).
- Reportes de gasto por categoría (será un segundo proyecto cuando el catálogo ya tenga datos).
- Integración con CFDI 4.0 para clasificación automática de gastos.
