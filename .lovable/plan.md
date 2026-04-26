# Auditoría arquitectónica v8.89.0 → mejoras detectadas

Estado general: **muy sano** tras Fases 1-3. La estructura por capas se respeta (cero violaciones de §3.1 — ninguna page ni componente importa el cliente Supabase directo). Lo que queda son **inconsistencias de organización** y **densidad excesiva** en algunas páginas. No hay anti-patrones graves.

## Hallazgos por categoría

### A. Inconsistencia de barrels en `src/services/` (alta prioridad)

La regla v8.86.0 dice "folder + index.ts, sin sufijo Service". Hoy quedan **17 archivos sueltos en raíz** que no la cumplen:

```text
authService.ts            bitacoraService.ts        catalogosService.ts
clientUserService.ts      clienteFinancialsService.ts  configuracionService.ts
csfService.ts             dashboardService.ts       facturasService.ts
operacionesService.ts     planesService.ts          proveedorServices.ts
reportesService.ts        searchService.ts          storage.ts
trackingService.ts        usuarioService.ts
```

Co-existen con `cliente/`, `embarque/`, `cotizacion/`, `proforma/`, `admin/`, `portal/` que sí siguen la regla. Inconsistencia interna del propio `services/`. La mayoría tiene 1 sólo consumidor; los más populares (storage, reportes, catalogos) son los que más justifican migrar a folder.

### B. Hooks raíz desorganizados (alta prioridad)

`src/hooks/` tiene **38 archivos sueltos** en raíz (muchos más que los 6 sub-dominios actuales). Agrupaciones obvias detectadas:

- **Portal**: `usePortalDashboardKpis`, `usePortalData`, `usePortalDocumentDownload` → `hooks/portal/`. Ya hay 2 hooks portal en `hooks/cotizacion/`, fragmenta el dominio.
- **Cliente**: `useClientes`, `useClienteFinancials`, `useClientUsersMutations` → `hooks/cliente/` (ya existe).
- **Configuración**: `useConfiguracion`, `useConfiguracionGlobal`, `useConfiguracionOrg`, `useConfiguracionState` → `hooks/configuracion/`.
- **Catálogos**: `useNavieras`, `usePuertos`, `useTiposContenedor`, `useExchangeRates`, `useTasaIVA`, `useOperadoresDistintos` → `hooks/catalogos/`.
- **Admin/Org**: `useAdminData`, `useAdminOrgDetalle`, `useOrganizationsList`, `useOrgFilter`, `useOrgMembersMutations`, `usePlanes` → `hooks/admin/` (ya existe parcialmente).
- **Dashboard**: `useDashboardData`, `useDesempenoChartData`, `useOperacionesData`, `useSidebarAlerts`, `useRentabilidadClientes` → `hooks/dashboard/`.

Los transversales legítimos (`useDebounce`, `useListPageState`, `usePermissions`, `useGlobalSearch`, `useBitacora`, `use-mobile`, `use-toast`) sí pueden quedar en raíz.

### C. Densidad excesiva en páginas (media prioridad)

Pages con >10 hooks ya superan el umbral de la regla §3.5 ("controllers para pages densas"):

| Page | Hooks | Acción |
|---|---|---|
| Embarques.tsx (241 LOC) | 14 | Extraer `useEmbarquesPageController` |
| EmbarqueDetalle.tsx | 13 | Extraer `useEmbarqueDetallePageController` (los hooks de acciones ya existen, falta el agregador) |
| Cotizaciones.tsx (245 LOC) | 12 | Extraer `useCotizacionesPageController` |
| Proveedores.tsx | 10 | Extraer `useProveedoresPageController` |
| ProveedorDetalle.tsx | 10 | Extraer `useProveedorDetalleController` |
| EditarCotizacion.tsx | 9 | Extraer `useEditarCotizacionController` |

Reportes y Cliente Detalle ya están refactorizados (Fase 1) — usar mismo patrón.

### D. Carpeta `src/test/` con un solo archivo (baja)

`src/test/` contiene **únicamente** `setup.ts` (config de Vitest). Después de borrar `example.test.ts` en v8.89.0, la carpeta tiene un único propósito. Opciones:
1. Mover a `src/setupTests.ts` o `vitest.setup.ts` en raíz (convención más común en el ecosistema).
2. Dejar como está (acepta como configuración).

Hoy está documentado en `vitest.config.ts` como `setupFiles: ["./src/test/setup.ts"]`; el cambio es trivial.

### E. `src/components/shared/` infrautilizado (baja)

Sólo contiene `ProfitBadge.tsx`. Carpeta entera para 1 componente. Decidir:
- Promover a `src/components/ProfitBadge.tsx` (raíz, donde están los 18 componentes globales como DataTable, GlobalSearch, etc.).
- O documentar la convención: "shared/ es el lugar canónico para componentes cross-domain" y mover otros componentes globales aquí (Layout, ErrorBoundary, ProtectedRoute…).

Lo que NO debe quedar: una carpeta con un solo archivo sin convención clara.

### F. Componentes grandes (media prioridad)

| Componente | LOC | Síntoma |
|---|---|---|
| `NuevoClienteDialog` (228) | Wizard de alta cliente; probablemente mezcla form + servicios CSF + UI. |
| `CotizacionWizardLayout` (222) | Layout + lógica de pasos. |
| `NuevoProveedorDialog` (202) | Mismo patrón que NuevoClienteDialog. |
| `PortalLayout` (196) | Layout portal cliente. |
| `AppSidebar` (204) | Aceptable (mucho JSX declarativo de nav). |
| `DataTable` (184) | Componente genérico reutilizable; LOC justificada. |

Los Dialogs con >200 LOC se benefician de extraer su lógica a controllers (`useNuevoClienteDialogController`, `useNuevoProveedorDialogController`). Mismo patrón que aplicado a páginas.

### G. `usePortalCotizacion*` mal ubicado (baja)

Viven en `hooks/cotizacion/` por tema, pero conceptualmente pertenecen al **portal de clientes**. Si se crea `hooks/portal/` (hallazgo B), moverlos ahí o mantenerlos donde están y documentar la decisión.

### H. Sin TODO/FIXME pendientes ✓

Cero comentarios de deuda técnica en código activo. `console.log` solo aparece en archivos legítimos (ErrorBoundary, NotFound, searchService).

## Plan ordenado (crítico → opcional)

1. **Estandarizar barrels en `src/services/`**: migrar los 17 servicios sueltos a folder + index.ts. Empezar por los de >2 consumidores (storage, reportes, catalogos, tracking, configuracion). Para los de 1 consumidor evaluar si tiene sentido un folder o si conviene fusionar con un dominio existente. Actualizar 30+ imports.

2. **Reagrupar `src/hooks/`**: crear `hooks/portal/`, `hooks/configuracion/`, `hooks/catalogos/`, `hooks/dashboard/`; mover los hooks raíz que correspondan (lista en §B). Mover `useClientes`, `useClienteFinancials`, `useClientUsersMutations` a `hooks/cliente/` existente. Actualizar imports.

3. **Extraer controllers de páginas densas** (§C): empezar por `Embarques.tsx` (14 hooks) y `Cotizaciones.tsx` (12 hooks). Patrón canónico ya aplicado en Reportes/ClienteDetalle.

4. **Extraer controllers de Dialogs densos** (§F): `useNuevoClienteDialogController`, `useNuevoProveedorDialogController`, `useCotizacionWizardLayoutController`. Bajan los componentes de >200 a ~120 LOC.

5. **Decidir destino de `src/components/shared/`** (§E): promover `ProfitBadge` a raíz y eliminar la carpeta, **o** mover los componentes cross-domain a `shared/` y documentar.

6. **Mover `src/test/setup.ts`** (§D) a `vitest.setup.ts` raíz y actualizar `vitest.config.ts`. Eliminar carpeta `src/test/`.

7. **Reubicar `usePortalCotizacion*`** (§G) a `hooks/portal/` cuando exista, o documentar la excepción en ARCHITECTURE.md.

8. **Documentar en ARCHITECTURE.md**: criterios para cuándo crear sub-carpeta en `hooks/` (umbral sugerido: ≥3 archivos de un mismo dominio) y reforzar la convención de barrels en services.

## Detalles técnicos

- Cero violaciones de capa detectadas (regla §3.1 limpia en pages y components).
- Bundle inicial ya optimizado (lazy de páginas, jsPDF dinámico, changelog tiered).
- Pruebas: 184/184 verdes; cobertura concentrada en `lib/` y hooks complejos como debe ser.
- Total LOC src/ excluyendo UI/tests/changelog: ~28K — proyecto medio bien dimensionado.

**Recomendación**: ejecutar pasos 1-3 en una primera iteración (v8.90.0); pasos 4-5 en v8.91.0; pasos 6-8 son nice-to-have y se pueden diferir.
