
Usuario quiere ejecutar las 5 acciones del plan que propuse sobre los 3 puntos citados. Verifico tamaños primero mentalmente con lo que ya sé:
- Reportes.tsx: ~270 líneas (visto en contexto)
- ClienteDetalle.tsx: ~280 (mencionado)
- 22 hooks useCotizacion*/useEmbarque* en src/hooks/ plano

Plan v8.38.0 — Reorganización final.

## Acciones

**1. Reorganizar hooks en subcarpetas**
- Crear `src/hooks/cotizacion/` y mover: `useCotizacionTypes`, `useCotizacionQueries`, `useCotizacionMutations`, `useCotizacionConversions`, `useCotizacionCostos`, `useCotizacionPL`, `useCotizacionDetalleState`, `useCotizacionDetalleHandlers`, `useCotizacionWizardForm`, `useCotizacionWizardSteps`, `useConceptosVentaCotizacion`, `useDuplicarCotizacion`, `usePortalCotizacionDetalle`, `usePortalCotizacionMutations`
- Crear `src/hooks/embarque/` y mover: `useEmbarqueQueries`, `useEmbarqueMutations`, `useEmbarqueForm`, `useEmbarqueFinancials`, `useEmbarqueDetalleActions`, `useEmbarqueDetalleTracking`, `useEmbarqueDocumentosActions`, `useEmbarqueEstadoActions`, `useEmbarquesListData`, `useEmbarquesPageState`, `useEmbarquesRelacionados`, `useEventosEmbarque`
- Mantener barrels `useCotizaciones.ts` y `useEmbarques.ts` en `src/hooks/` (raíz) para no romper imports externos
- Actualizar imports internos de los barrels a las nuevas rutas

**2. Refactor preventivo de pages cercanas al límite ESLint (250 LOC)**
- `Reportes.tsx`: extraer `<ReportesFiltros>`, `<ReportesKpiCards>`, `<ReportesTopChart>`, `<ReportesTablaClientes>` a `src/components/reportes/`
- `ClienteDetalle.tsx`: revisar y extraer secciones si supera 250 LOC

**3. Documentación**
- Actualizar `ARCHITECTURE.md` con nueva estructura `hooks/cotizacion/` y `hooks/embarque/`
- Añadir entrada v8.38.0 al `Changelog.tsx`
- Actualizar entrada en `changelogData.ts` (es lo mismo o paralelo)

## Riesgo
Bajo. Los barrels absorben los movimientos. Se ejecutará `npm test` al final para confirmar 139/139.

## Archivos no tocados
- `src/integrations/supabase/types.ts` — auto-generado, intocable
- 6 hooks restantes que no son cotización/embarque (`useBitacora`, `useClientes`, `useDashboardData`, etc.) se quedan en raíz
