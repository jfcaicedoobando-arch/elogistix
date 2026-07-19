
## Veredicto de la auditoría

La auditoría es **sólida y coherente** con el trabajo de Ola 3/4. Cierra exactamente los dos pendientes que quedaban abiertos:

1. **9 clones de KPI card** migrados al `KpiCard` canónico (elimina ~190 líneas duplicadas, uniformiza `gap-3` y las semánticas `warn→warning`, `bad→destructive`, `sub→sublabel`, hints→`valueTooltip`).
2. **3 colores hardcodeados** reales reemplazados por tokens (`slate-100→border`, `blue-500→info`, `cyan-500/600→primary`).
3. **Justificaciones aceptables**:
   - `LogoPreview.tsx`: sujeto de prueba del logo sobre lienzos fijos — no tocar.
   - `DialogDetallePagosProveedor.parts.tsx → Kpi`: es un stat-cell dentro de diálogo, no un KPI de página — no migrar.

Diseño y convenciones alineados con lo establecido en Sprint 2 (Ola 3 enriqueció `KpiCard` con `iconVariant="chip"`, `valueTooltip`, `sublabel`, variants `accent`/`secondary`). No detecto conflictos con memoria del proyecto ni con el design system.

## Plan de aplicación

### 1. Aplicar el patch
Aplicar `cierre_parciales_ui.patch` tal cual. Toca 13 archivos (+137 / −327):

- **Migraciones KPI (9)**: `bandejas/CxpPorCapturar`, `comisiones/Comisiones`, `compras/ComprasPorAprobar` (+ borra `ComprasPorAprobar.kpi.tsx`), `costeo/TarifasKpis`, `cxp/CxpKpiCards`, `facturacion/DashboardEjecutivoFacturacion`, `presupuesto/TabVsReal`, `proveedor/ProveedorSaludTab`, `tesoreria/TesoreriaFlujo`.
- **Colores (3)**: `cotizacion/TablaCostosLocal.tsx`, `lib/ui/estadoConfig.ts`, `dashboard/statusCards/ArribosCard.tsx`.

### 2. Verificación tras aplicar
- `bun run lint -- --max-warnings 0`
- `bun run ci:fast` (typecheck + tests fast). Especial atención a:
  - `no-legacy-color-literals.test.ts` — validar que no queden entradas en el allowlist para los 3 archivos corregidos.
  - Tests que puedan estar snapshotenando `Kpi`/`KPICard` locales (poco probable, pero revisar).
- Smoke visual en `/compras/por-aprobar`, `/tesoreria/flujo`, `/comisiones`, `/proveedores/:id` (tab Salud), `/presupuesto` (tab vs Real) y el dashboard ejecutivo de facturación.

### 3. Podar allowlist de colores
Editar `src/__tests__/architecture/no-legacy-color-literals.test.ts` para retirar (si estaban listados) las 3 rutas ahora limpias.

### 4. Nota de entorno (no bloqueante)
La auditoría menciona que `npm ci` falla por `@eslint/js@^10.0.1` vs `eslint@9.32.0`. En este proyecto usamos **bun**, así que no aplica al pipeline nuestro. Registrar en `.lovable/audit-todos.md` como observación para futura alineación de `package.json` si migramos.

### 5. Cambios de versión y changelog
- `APP_VERSION` → `13.302.5`.
- Entrada en `CHANGELOG.md`:
  ```
  ## [13.302.5] - 2026-07-19
  - Sprint 2 Ola 4: 9 clones `KpiCard` migrados al canónico (~190 líneas duplicadas eliminadas).
  - Colores hardcodeados residuales reemplazados por tokens semánticos (`slate-100`, `blue-500`, `cyan-500/600`).
  - `LogoPreview` y stat-cell de diálogo justificados como no migrables.
  ```

## Detalles técnicos

- **Anillo de "filtro activo"** en `TarifasKpis`: la auditoría lo resuelve con `ring-2 ring-<token>/60` mapeado por `KpiVariant`, sin tocar el componente compartido. Buena solución sin ensuciar la API.
- **`DashboardEjecutivoFacturacion`**: cambia strip `divide-x` por grid de `KpiCard` + usa `valueTooltip` en lugar de `Tooltip` manual (borra `TooltipProvider` innecesario). Alineado con memoria de tooltips inline.
- **`CxpKpiCards`**: el `count` se pliega al label vía helper `countLabel` porque el canónico no expone slot para contador secundario — trade-off aceptable (evita hinchar la API).

## Riesgos y qué podría romperse

- **Bajo**: cambios puramente presentacionales, sin tocar lógica ni servicios.
- **Posible regresión visual** en anchos donde `TarifasKpis` pasaba de flex-wrap a grid `md:grid-cols-4` — verificar en 1280 y 1920.
- **Snapshot tests** de las 9 páginas migradas: si existen, hay que aceptar snapshots nuevos.

¿Aplico el patch?
