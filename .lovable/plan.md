# Continuación del plan — Fases 4 (restante) y 5

Las Fases 1-3 y parte de la 4 ya están aplicadas en `12.16.7`. Quedan los ítems de bajo riesgo / cosméticos.

---

## Fase 4b — Refactors mecánicos restantes (HIGH)

Bump a **`12.16.8`**.

1. **`FILTER_ALL` constante** — `src/constants/filters.ts`
   - `export const FILTER_ALL = 'todos' as const;`
   - Reemplazar literales `'todos'` en filtros de tablas/selects (≈15 call sites). Preservar valor exacto para no romper URLs serializadas.
2. **Mover `eventoSchema`** de `TrackingNuevoEventoForm.tsx:18` → `src/lib/validation/mutationSchemas.ts`. Form importa el schema.
3. **Extraer CSV de proyección** — `useTabProyeccionController.ts:89` → `src/lib/facturacion/proyeccionCsv.ts` (espejando `huecoCsv.ts`).
4. **`CARRIER_TRACKING_URLS`** — `src/constants/carriers.ts`. Mover las 10 URLs hardcoded de `externalTracking.ts`.
5. **Aplicar `uniqueSorted`** en los 6 call sites pendientes (ya existe la utilidad).
6. **Controllers para páginas god** (riesgo medio — hacer al final de la fase):
   - `usePapeleraController` (extrae de `pages/admin/Papelera.tsx`)
   - `usePortalFacturasController` + `usePortalCotizacionesController` (espejo de `usePortalEmbarquesController`)
   - Mover `invalidateQueries` de `pages/clientes/Clientes.tsx` al hook de mutation correspondiente

**Verificación:** `bun run lint` + `bunx vitest run` (781 tests deben quedar verdes), revisión manual de filtros en Embarques/Facturación/Portal.

---

## Fase 5 — Limpieza estética (OK)

Bump a **`12.16.9`**.

7. **Renombres a PascalCase** (usar `git mv` case-sensitive):
   - `adminOrganizacionesColumns.tsx`, `adminUsuariosColumns.tsx`, `diagnosticoColumns.tsx`
   - `cotizacion/columnsParts/accionesCell.tsx`, `estadoVigenciaCell.tsx`
8. **`SeccionMercanciaMaritimeLCL.tsx` → `SeccionMercanciaMaritimaLCL.tsx`** (consistencia es-MX).
9. **Borrar código muerto:**
   - Import comentado en `src/integrations/supabase/client.ts:9`
   - Section headers vacíos en `useTabProformasController.ts:55-67`
   - Bloques `(legacy)` en `stylesContent.ts` (verificar antes de borrar)
10. **Header `// @generated`** en `src/integrations/supabase/types.ts` (solo header, sin tocar contenido).
11. **`src/components/ui/sidebar.tsx` (637 líneas)** — **omitir**: es shadcn vendored, costo > beneficio.

**Verificación:** `bun run lint` + `bunx vitest run`. TS detecta imports rotos automáticamente.

---

## Orden y entregables

```text
Fase 4b (12.16.8)  →  Fase 5 (12.16.9)
```

- Cada fase: 1 entrada en `CHANGELOG.md` + bump `APP_VERSION`.
- Mantener Power of 10: componentes ≤200 líneas, no `any`, cleanup en effects.
- No introducir `style={{...}}` (mem://principles/inline-styles).

## Decisión pendiente

- ¿Aplicar **ambas fases** en un solo turno, o **solo Fase 4b** y dejar Fase 5 para otro pase?
- ¿Incluir los controllers de páginas god (ítem 6) ahora o diferirlos otra vez? Es el cambio de mayor superficie de la Fase 4b.

## Fuera de alcance (confirmado)

- `supabase/types.ts` salvo el header `@generated`.
- Renombre de carpeta `org-detalle/`.
- Split de `sidebar.tsx`.
- Opción A (migración DB para `embarques_listado` con `p_limit = null`) — Opción B ya quedó implementada en 12.16.7.
