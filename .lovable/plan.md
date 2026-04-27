## Auditoría — Resultado

La arquitectura está **sana** tras v8.99.0:
- Capas UI → hooks → services → supabase respetadas (cero llamadas directas a Supabase desde UI).
- Páginas agrupadas por dominio, hooks con barrels, mutations divididas, conversiones modularizadas.
- 205/205 tests pasan, build TS limpio.

No hay problemas críticos. Las observaciones restantes son de **pulido**, no de deuda estructural.

## Hallazgos (ordenados por impacto)

1. **Servicios sueltos en `src/services/` rompen la convención folder-style.**
   Conviven 7 archivos `*Service.ts` en la raíz de `src/services/` (`operacionesService.ts`, `reportesService.ts`, `trackingService.ts`, `proveedorServices.ts`, `planesService.ts`, `clienteFinancialsService.ts`, `clientUserService.ts`) mientras que `cotizacion/`, `embarque/`, `cliente/`, etc. usan carpeta + `index.ts`. Inconsistencia.

2. **`useNuevoEmbarqueWizard.ts` (260 líneas)** sigue siendo el hook más grande tras los splits. Concentra orquestación + estado del wizard. Candidato a extraer un `useNuevoEmbarqueState.ts` separando estado puro del orquestador.

3. **`CotizacionWizardLayout.tsx` (222 líneas)** mezcla layout + lógica de navegación entre pasos. Podría extraerse un `useCotizacionWizardNavigation` hook.

4. **`useEmbarqueMutations.ts` reducido a un re-export de 6 líneas** — ya no aporta. Una vez migrados los consumidores al barrel `@/hooks/embarque`, se puede eliminar.

5. **Hooks de cotización sin sub-agrupación.** `src/hooks/cotizacion/` tiene 18 archivos planos (queries, mutations, controllers, wizard, portal mezclados). Beneficiaría una sub-carpeta `mutations/` y `wizard/` como ya hace `embarque/`.

## Plan en 1 paso (v8.99.1)

Las 5 mejoras se ejecutan juntas porque son todas movimientos/renombres con re-exports de compatibilidad:

1. **Folderizar servicios sueltos**: convertir cada `xService.ts` en `src/services/<dominio>/index.ts` (operaciones, reportes, tracking, proveedor, planes). `clienteFinancialsService.ts` y `clientUserService.ts` se mueven dentro del existente `services/cliente/` como módulos. Mantener re-export desde la ruta antigua.

2. **Extraer estado del wizard de embarque**: crear `src/hooks/embarque/useNuevoEmbarqueState.ts` con el `useState`/`useForm` y dejar `useNuevoEmbarqueWizard.ts` como orquestador delgado (<150 líneas).

3. **Extraer navegación del wizard de cotización**: crear `src/hooks/cotizacion/useCotizacionWizardNavigation.ts` con la lógica de pasos extraída de `CotizacionWizardLayout.tsx`.

4. **Sub-agrupar `hooks/cotizacion/`**: crear sub-carpetas `mutations/` (mover `useCotizacionMutations`, `useDuplicarCotizacion`, `usePortalCotizacionMutations`) y `wizard/` (mover `useCotizacionWizardForm`, `useCotizacionWizardSteps`, `useConceptosForm`). Actualizar `index.ts` para mantener API pública intacta.

5. **Eliminar shim `useEmbarqueMutations.ts`**: actualizar el único punto restante que aún lo importa (si lo hay) al barrel y borrar el archivo de 6 líneas.

### Verificación
- `tsc --noEmit` limpio
- 205/205 tests pasan
- Entrada en `Changelog.tsx` v8.99.1 con resumen de la consolidación arquitectónica.

### Si prefieres no tocar nada
Honestamente, ninguna de estas mejoras es bloqueante. Si el equipo está enfocado en features, este refactor puede esperar — el código ya está en buen estado. Solo dime y lo dejamos pendiente.