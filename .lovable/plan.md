## Problema

El job **Lint, typecheck, unused code & build** falla porque `src/hooks/layout/useAppSidebarSections.ts` creció a **253 líneas** tras agregar `buildAdmin`, y el test `architecture-baseline` (Power of 10) exige ≤ 200 líneas en archivos productivos.

```
- src/hooks/layout/useAppSidebarSections.ts (253 líneas): expected [...] to deeply equal []
```

## Solución

Extraer los **13 builders por rol** a un módulo nuevo, dejando `useAppSidebarSections.ts` como orquestador pequeño.

### Archivos

1. **Nuevo: `src/hooks/layout/sidebarRoleBuilders.ts`** (~170 líneas)
   - Exporta tipos `SidebarSection`, `BuilderDeps`, `Builder`.
   - Exporta los helpers `filterBandejas`, `filterGestion`, `filterSistema`, `filterDirectorio`.
   - Exporta los 11 builders: `buildVendedor`, `buildCustomerService`, `buildCoordinador`, `buildEjecutivoPricing`, `buildContador`, `buildTesorero`, `buildAuxiliarContable`, `buildEjecutivoCobranza`, `buildGerenteComercial`, `buildGerenteOperaciones`, `buildAdmin`.
   - Exporta `ROLE_BUILDERS` y `buildDefaultSections`.

2. **Editar: `src/hooks/layout/useAppSidebarSections.ts`** (queda ~60 líneas)
   - Solo conserva el hook `useAppSidebarSections`, el helper `patchEmbarquesBadge` y los `useQuery` de badges.
   - Importa todo lo demás del nuevo módulo.

3. **`src/constants/appVersion.ts`** → `13.98.3`.

4. **`CHANGELOG.md`** → entrada `[13.98.3]` describiendo el split (chore/refactor sin cambios funcionales).

### Verificación

- `bunx vitest run src/__tests__/audit-report.test.ts src/lib/__tests__/architecture-baseline.test.ts`
- Smoke: `bunx vitest run src/routes/__tests__/appRoutes.smoke.test.tsx` y `src/hooks/layout/__tests__/useLayout.test.tsx` (si existe).

### Lo que NO cambia

- Comportamiento del sidebar para ningún rol.
- API pública del hook `useAppSidebarSections()`.
- Etiquetas/rutas/permisos.
