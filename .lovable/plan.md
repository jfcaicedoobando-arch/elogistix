# Plan: Remediación completa de la 2ª auditoría visual

Aplico los 10 hallazgos detectados, agrupados por riesgo y tipo de cambio. Versión final: `13.139.16` → `13.139.18` (una por lote).

## Lote A — Crítico + Alto (v13.139.16)

Cambios pequeños, alto impacto visual. Sin tocar lógica.

1. **Clientes — input de búsqueda desbordado**
   - Archivo: `src/features/clientes/routes/Clientes.tsx` (o componente de filtros)
   - Añadir `max-w-sm` al `<Input>` de búsqueda para alinearlo con Embarques/CXP.

2. **CXP / Facturación — `TabsList` con altura distinta (~54px vs ~38px)**
   - Archivos: `src/features/cxp/**` y `src/features/facturacion/**` donde se renderiza `<TabsList>`.
   - Eliminar overrides de `h-*`/`py-*`/`p-*` para usar la altura por defecto del componente shadcn (h-10) idéntica a Embarques.

3. **Topbar — contraste de borde del buscador (~1.12:1, no cumple WCAG AA)**
   - Archivo: `src/components/layout/Topbar.tsx` (o equivalente)
   - Cambiar `border-border/40` → `border-border` y `placeholder:text-muted-foreground/60` → `placeholder:text-muted-foreground/80`.

4. **CXP — botón de acción del filtro desalineado**
   - Archivo: filtros de `src/features/cxp/routes/Cxp*.tsx`
   - Quitar `ml-auto` del botón y envolver acciones en `<div className="flex items-center gap-2">` al final del contenedor flex, igual que Embarques.

## Lote B — Medio (v13.139.17)

5. **Bandejas (Facturación-por-emitir / Cartera) — tabs no visibles**
   - Confirmar si deben tener tabs (estados Pendiente/Procesada). Si sí: añadir `<Tabs>` con la misma variante underline. Si no: cerrar como falso positivo y dejarlo documentado en CHANGELOG.

6. **Falta variante `warning` en `Badge`**
   - Archivo: `src/components/ui/badge.tsx`
   - Añadir variant `warning` con tokens semánticos (`bg-warning/10 text-warning border-warning/20`). Verificar que existen los tokens en `index.css`; si faltan, añadirlos.

7. **Embarques — página de 4725px (paginación)**
   - Revisar `EmbarquesTable` / `useEmbarques`: confirmar `pageSize` default. Si está en server-side, sólo verificar que el default sea 25 y que el control de densidad esté visible. Sin cambios de lógica.

8. **Cotizaciones — página de 3515px**
   - Mismo patrón que #7: validar `pageSize` y control de densidad.

## Lote C — Bajo + recap (v13.139.18)

9. **Inicio — altura 2747px**
   - Verificar que los `Card` del dashboard usen `p-6` y `shadow-sm` (ya aplicado en lote previo). Ajustar `gap-6` entre secciones si hay aire muerto.

10. **Facturación — padding/margin inconsistente (+98px)**
    - Igualar wrapper de `Facturacion.tsx` a `Embarques.tsx` (`<div className="space-y-6 p-6">` o el patrón estándar).

## Validación

Tras cada lote:
- `bun run lint` (cero warnings nuevos).
- Sub-agente Playwright re-captura las rutas afectadas a 1280×1800.
- Bump `APP_VERSION` y entrada en `CHANGELOG.md` con formato `## [X.Y.Z] - 2026-06-28`.

## Fuera de alcance

- No se toca lógica de negocio, queries, ni RLS.
- No se migran más rutas a `PageHeader` (portal/cliente/marketing/legal/auth se quedan como están — fuera del producto interno).
- No se rediseñan componentes; sólo se alinean a los tokens y patrones existentes.
