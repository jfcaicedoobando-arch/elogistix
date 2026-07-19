# ¿Tiene sentido la auditoría? Sí, en gran medida.

Verifiqué los números clave contra el código actual y coinciden: 129 usos de `text-[11px]`, 31 de `text-[10px]`, el token `text-2xs` ya existe pero no se adoptó, `PageContainer` fija `max-w-screen-2xl`, `KpiCard` canónico existe en `src/components/shared/`, y hay ~9 literales `violet-/amber-` en el clúster de cotización. Los hallazgos son reales y accionables.

**Matices antes de aplicar todo a ciegas:**

- **§1.1 (ancho 1920px):** subir el default de `PageContainer` a `max-w-[1600px]` cambia TODAS las páginas. Riesgoso. Mejor opción B: dejar el default y pasar `className="max-w-none xl:max-w-[1760px]"` sólo en las rutas de tablas densas (Facturación, Cobranza, CxP). Decisión producto.
- **§3.1 (barrido `sed` masivo):** los reemplazos regex son correctos pero tocan ~165 archivos en un solo commit. Prefiero hacerlo por carpetas (facturación, embarques, marketing, resto) para que el diff sea revisable y no rompa tests visuales.
- **§4.1 (migrar 14 clones a `KpiCard`):** cambia tipografía (fija → adaptativa) y padding. Debe validarse visualmente por módulo. Sprint separado.
- **§3.2 (colores cotización):** el mapeo `amber → warning`, `violet → primary` asume equivalencia semántica que hay que confirmar caso por caso (a veces `violet` era decorativo, no "acción principal").
- **NO tocar** lo que la auditoría marca como sano: modales, botones, `estadoConfig`, inline styles en `src/pdf/` (react-pdf los exige).

---

## Plan de aplicación (2 sprints)

### Sprint 1 — Tipografía y color (alto impacto / bajo riesgo)

1. **Token faltante** en `tailwind.config.ts`:
   ```ts
   label: ["0.6875rem", { lineHeight: "1rem" }]  // 11px
   ```
   y clase utilitaria `.text-overline` en `src/index.css`.

2. **Barrido tipográfico por carpeta** (4 PRs pequeños, no uno gigante):
   - `src/features/facturacion/**`
   - `src/features/embarques/**` y `src/features/cxp/**`
   - `src/features/marketing/**`
   - resto de `src/**`

   Reemplazos: `text-[11px]→text-label`, `text-[10px]→text-2xs`, `text-[9px]→text-3xs`, `text-[8px]→text-3xs`.

3. **Colores del clúster cotización P&L** (`ResumenPL.tsx`, `TablaCostosLocal.tsx`, `SeccionCostosInternosPLDetalle.tsx`, `SeccionCostosInternosPLLocal.tsx`, `WizardTotalsBar.tsx`): revisar significado y migrar a `--primary`, `--info`, `--warning`, `--success` (no automático).

4. Actualizar `CHANGELOG.md` + bump `APP_VERSION`.

### Sprint 2 — Estructura y componentes

5. **Ancho de páginas densas:** override `max-w-none xl:max-w-[1760px]` en las rutas de Facturación / Cobranza / CxP (no cambiar el default global).
6. **Constantes de columnas** en `src/lib/ui/tableColumns.ts` (`COL.folio/fecha/moneda/monto/acciones`) y adopción en tablas densas.
7. **Convención de padding:** `p-4` en tablas/KPI strip, `p-6` en formularios/detalle. Eliminar los 3 `p-5`, revisar los 21 `p-3`.
8. **Migrar los ~14 clones de KPI** a `KpiCard` canónica, un módulo por PR (empezar por `CxpKpiCards` que es el más citado), validando visualmente.
9. Bump `APP_VERSION` + `CHANGELOG.md` por sprint.

## Detalles técnicos

- Los `sed` propuestos usan `\b` (word boundary); seguros para no tocar `text-[110px]` inexistentes, pero verificaré `bun run typecheck` + `bun run lint` tras cada barrido.
- El token `text-2xs` ya existe (`0.625rem`); solo falta `label` para `text-[11px]`.
- `PageContainer` ya acepta `className`, no requiere API nueva.
- Los `text-[10px]×8` de `LandingHero` entran al barrido (la landing tiene paleta propia pero no debe romper el sistema tipográfico).
- No hay migraciones de BD ni cambios de lógica de negocio en ninguno de los dos sprints.

## Fuera de alcance / rechazado

- Subir el default de `PageContainer` a 1600px globalmente (riesgo alto, poco beneficio en páginas de formulario).
- Un único PR gigante con los 165 reemplazos tipográficos.
- Tocar `src/pdf/` (react-pdf exige inline styles).

¿Arranco por el Sprint 1 completo, o prefieres que primero haga sólo el paso 1+2 (token + barrido) y validamos antes de tocar cotización?
