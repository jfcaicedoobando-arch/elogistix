# Cierre de refinación móvil 20:9 — Fases 5b, 6 y validación

Solo cambios de UI/presentación. Sin tocar lógica de negocio, queries ni mutaciones.

---

## Fase 5b — Cobertura legacy pendiente

### 5b.1 Páginas con padding fijo `p-6/p-8` → `p-4 sm:p-6` + `space-y-4 sm:space-y-6`
- `src/pages/profit/ProfitDashboardEjecutivo.tsx`
- `src/pages/profit/ProfitEstadoResultados.tsx`
- `src/pages/profit/ProfitPresupuesto.tsx`
- `src/pages/profit/ProfitProyeccion.tsx`
- `src/pages/tesoreria/TesoreriaCuentas.tsx`
- `src/pages/tesoreria/TesoreriaFlujo.tsx`
- `src/pages/admin/AdminOrganizaciones.tsx`, `AdminUsuarios.tsx`, `AdminConfiguracion.tsx`, `Papelera.tsx`, `AdminOrgDetalle.tsx`
- `src/pages/admin-org/Usuarios.tsx`, `Configuracion.tsx`
- `src/pages/comisiones/Comisiones.tsx`
- `src/pages/dashboard/Reportes.tsx`
- `src/pages/portal/PortalDashboard.tsx`, `PortalPerfil.tsx`

### 5b.2 KPIs legacy → `KpiStrip`
- `ProfitDashboardEjecutivo` (la grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-6`) — opcional, ya colapsa, pero se gana carrusel snap en `<sm`.
- `TesoreriaFlujo` (grid `grid-cols-2 md:grid-cols-4`).
- `PortalDashboard` (`PortalKpiGrid`).

### 5b.3 Tabs con muchas pestañas → scroll horizontal
Envolver `TabsList` en `overflow-x-auto scrollbar-thin` + `TabsList` con `w-max min-w-full justify-start`:
- `ProfitPresupuesto`, `ProfitEstadoResultados`, `ProfitProyeccion` (si aplica)
- Auditoría (donde haya tabs largos)
- CRM dashboards con tabs.

### 5b.4 Diálogos/wizards anchos
Donde haya `DialogContent` fijo con `max-w-*` y sin altura:
- `max-w-full sm:max-w-2xl` (o el ancho original como tope sm+)
- `max-h-[90dvh] overflow-y-auto`
- Cobertura: wizards cotización, cliente, embarque, proveedor.

### 5b.5 `PageHeader` responsive
`src/components/shared/PageHeader.tsx`:
- Título `text-2xl sm:text-3xl`, descripción `line-clamp-2`.
- Acciones: `w-full sm:w-auto` cuando vengan; en `<sm` apiladas full-width.
- Mantener API actual.

### 5b.6 Proveedores (Fase 4 pendiente)
- `src/pages/proveedores/ProveedoresFiltros.tsx` → migrar a `MobileFiltersSheet` (search visible, selects al Sheet).

---

## Fase 6 — Tipografía fluida y pulido visual

### 6.1 Escala tipográfica consistente
- Reemplazar `text-3xl`/`text-4xl` aislados por pares `text-2xl sm:text-3xl` / `text-3xl sm:text-4xl`.
- KPIs grandes (`text-2xl`/`text-3xl` en cards): añadir `tabular-nums break-words` y bajar a `text-xl sm:text-2xl` donde se desborden en 343px.

### 6.2 `clamp()` puntual
Añadir utilidades en `tailwind.config.ts` (extend.fontSize):
- `display`: `clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)` (h1 de PageHeader)
- `kpi`: `clamp(1.125rem, 0.95rem + 0.8vw, 1.5rem)` (valores KPI)
Aplicar solo donde se observe overflow en 343×604.

### 6.3 Inputs y selects en móvil
- `min-h-10` en `Input`/`Select` para tap target ≥40px.
- `<input type="date">` Safari iOS: forzar `appearance-none` + `min-h-10` para evitar altura inconsistente.

### 6.4 Sin overflow horizontal
- Auditar contenedores con `whitespace-nowrap` sin `overflow-x-auto`.
- Añadir `min-w-0` a flex children con texto largo.

---

## Fase 7 — Validación visual

### 7.1 Screenshots móvil (412×915) y desktop (1366×768)
Rutas a capturar después de los cambios:
- `/dashboard`, `/embarques`, `/proveedores`
- `/crm/leads`, `/crm/oportunidades`, `/crm/mi-dia`
- `/cxp`, `/reportes`, `/auditoria`
- `/profit/dashboard-ejecutivo`, `/profit/estado-resultados`, `/profit/presupuesto`
- `/tesoreria/cuentas`, `/tesoreria/flujo`
- `/admin/organizaciones`, `/admin-org/usuarios`
- `/portal/dashboard`, `/portal/perfil`

### 7.2 Checklist por captura
- Search siempre visible en listados.
- Botón "Filtros (n)" abre Sheet con badge correcto.
- Sin scroll horizontal en `<sm`.
- Header apilado correctamente, sin truncar acciones.
- Tabs scrollables sin cortar etiquetas.
- KPIs sin overflow ni tipografía rota.

### 7.3 `tsc --noEmit` limpio tras cada fase.

---

## Metadata
- Fase 5b → `13.20.0` + entrada `CHANGELOG.md`.
- Fase 6 → `13.21.0` + entrada `CHANGELOG.md`.
- Validación → nota breve en changelog (`13.21.1` si hay ajustes finos).

## Excluye
- Lógica de negocio, queries, mutaciones.
- Refactor de tablas (Fase 2 ya cerrada).
- Tests Vitest sobre `KpiStrip`/`MobileFiltersSheet` (solo si surge regresión).

## Orden de ejecución
1. **Fase 5b** completa (padding + KPIs + tabs + diálogos + PageHeader + Proveedores) → bump `13.20.0`.
2. **Fase 6** (tipografía fluida + inputs + overflow) → bump `13.21.0`.
3. **Fase 7** (screenshots + checklist) → ajustes finos si aparecen y bump patch si aplica.
