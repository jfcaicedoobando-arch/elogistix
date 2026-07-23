# Estado actual vs. plan R3-Sprints_2

## ✅ Ya hecho

### Sprint 1 — completo
- **1.1 FIX-R3-01**: `guard_pago_proveedor` corregido (UPDATE ya valida `NEW.monto_en_moneda_factura` directo contra `v_saldo`, sin el bug del delta). Aplicado en v13.309.38.
- **1.2 Tests conductuales SQL**: `supabase/tests/cxp_guard_sobrepago.sql` creado y cableado en CI. Fixture arreglado (v13.309.47) para satisfacer NOT NULLs y `pagos_proveedor_tc_pos`.
- **1.3 Ban `@/features/**` en `src/lib/**`**: aplicado en `eslint.config.js` con allowlist `ARCH-DEBT`.

### Sprint 2 — parcial (A y C hechos, falta B)
- **2.1 Paridad roleHierarchy ↔ has_role()**: `roleHierarchy.invariant.test.ts` agregado + `viewer` corregido (v13.309.45).
- **2.3 Regla queryKey cubre `TSAsExpression`**: extendida; `useConceptosCfdiFactura` y `usePresupuestoCategorias` migrados (v13.309.46).
- **2.4 3 ciclos runtime**: rotos (`useSaldosCuentas`, `admin/services/usuario`, `proveedor/services/operaciones`).
- **2.6 `bitacora/registrar` → services**: reubicado a `src/services/bitacora/`.
- **2.7 Complejidad**: `useEmbarqueEstadoActions`, `useNuevoProveedorController.isStep1Valid`, `useOperacionesData` refactorizados a CC ≤10 (v13.309.48).

## ⏳ Falta

### Sprint 2 — cerrar
- **2.2 PR-S2-B — `EmbarqueDetalleHeader` (33 props)**: consumir bundle de `useEmbarqueEstadoActions` dentro del header (patrón `useEmbarqueDetalleTabsData`) y unificar `EmbarqueProp`/`EmbarqueRow` para eliminar el `as unknown as` de `EmbarqueDetalleTabs.tsx:34`.
- **2.5 Hooks→components runtime**: mover `buildEmbarqueColumns` y `findOriginalFacturaIdFor` a services/domain; imports type-only restantes → `types/`.
- **2.7 (cierre)** subir `complexity` de warn→error con allowlist ARCH-DEBT (solo tras 2.2/2.5).
- **2.6 (cierre)** ampliar roots de `scripts/lib/arch.ts` a `src/lib/**` con allowlist infra.

### Sprint 3 (2-4 semanas)
1. PR-6 formularios: `useNuevaFacturaProveedorForm` + `useEditarFacturaProveedorForm` → RHF+zod; luego `SignupForm`/`ResetPassword`. (Fase 1 del schema ya hecha en v13.309.28; falta wiring completo).
2. Hidratación wizard: reemplazar `useHidratacionEditarEmbarque` por `defaultValues`/`reset` de RHF.
3. Status registry Oleada 2 (`desempenoVisuals`, `leadsColumns`, 137 literales `estado ===`) + regla lint.
4. Retrofit LC_ backend (H7 dura), registrar 5 helpers en schema-invariants, split `operaciones_stats` (308L), PR dedicada de H6 legacy.
5. Dead code: borrar `ui/icon.tsx` + 10 barrels `features/*/index.ts`; knip burn-down (20 exports / 101 tipos / 5 deps).
6. Clones jscpd: `ConceptoRowMXN/USD`, trío `Portal*MobileFilters`, `CosteoNavieras ↔ AgenteGarantias`, `BandejaPorEnviar ↔ Timbrar`; fusionar `MobileFilterSheet`/`MobileFiltersSheet`.

### Sprint 4 (opcional)
- Bans: `Intl.DateTimeFormat` fuera de `lib/formatters`, `sonner` directo en `src/features/**` (82), limpiar flags coverage=0.
- Layout/docs, políticas catches/SAFE-CAST, DX (Prettier, react-hooks v7).

## Recomendación
Arrancar por **PR-S2-B** (unificar `EmbarqueProp`/`EmbarqueRow` + reducir props del header). Es el único item de Sprint 2 con impacto de UI/tipos y desbloquea subir `complexity` a error. Luego 2.5 y cerrar Sprint 2 antes de tocar Sprint 3.

¿Arranco con PR-S2-B?
