# Auditoría arquitectónica — post v8.100.1

## Resumen ejecutivo

La base de código está **en muy buen estado** tras los refactors v8.100.0 y v8.100.1. La separación de capas (UI → hooks → services → Supabase) se respeta de forma casi total, los archivos están dimensionados (ningún componente/página supera 250 LOC excepto el `sidebar.tsx` de shadcn que es código vendor), y la convención de barrels en `src/services/*/index.ts` se aplica de forma consistente.

**No hay deuda crítica pendiente.** Solo se detectaron 3 mejoras menores opcionales.

## Hallazgos

### Lo que está bien

- **0 fugas** de `@/integrations/supabase/client` en `src/components/**` y `src/pages/**`.
- Solo **1 archivo de hook** importa el client de Supabase directamente (`useAuditoriaRevisiones.ts`) y es para `auth.getUser()`, no para queries de datos.
- **22 dominios de servicios** organizados con barrel `index.ts` (cliente, cotizacion, embarque, proforma, auditoria, etc.).
- Tipos centralizados en `src/types/*` sin duplicación.
- Lógica pura aislada en `src/lib/domain/*` con tests dedicados.
- Páginas delgadas: la más pesada es `Auditoria.tsx` (229 LOC) y delega todo a `useAuditoriaPageController`.
- El wizard de embarque (`useNuevoEmbarqueWizard`, 260 LOC) ya está descompuesto en sub-hooks (`useEmbarqueForm`, `useConceptosForm`, `useCotizacionHydration`, `useEmbarqueSubmitOrchestrator`) — no hay margen claro para reducirlo más sin perder cohesión.

### Mejoras menores detectadas

1. **`src/services/portal/` sin barrel `index.ts`**
   - Tiene `columns.ts` y `queries.ts` sueltos. Es la única carpeta de servicios sin barrel.
   - Impacto: bajo (los consumidores importan rutas específicas hoy), pero rompe consistencia.

2. **`useAuditoriaRevisiones.ts` accede a `supabase.auth.getUser()` directamente**
   - Dos llamadas (líneas 59 y 129) para obtener el usuario actual antes de upsert/delete + bitácora.
   - Idealmente debería usar el `AuthContext` (que ya tiene `user`) o un helper `getCurrentUserOrThrow()` en `src/services/auth`.
   - Impacto: bajo, pero es la única fuga restante de Supabase client en hooks.

3. **`src/services/embarque/queries.ts` (246 LOC)** y **`src/lib/domain/embarqueWizardSchemas.ts` (298 LOC)** rondando el umbral
   - Ninguno lo cruza, pero son los siguientes candidatos si crecen.
   - `queries.ts` podría partirse por entidad relacionada (conceptos / documentos / notas / facturas) si se añade más superficie.
   - `embarqueWizardSchemas.ts` ya está bien agrupado por paso; mejor dejarlo.

## Plan recomendado (orden de prioridad)

### Críticos
*Ninguno.*

### Mejoras opcionales (rápidas y seguras)

1. **Crear `src/services/portal/index.ts`** que re-exporte `columns` y `queries`. Actualizar consumidores para importar desde `@/services/portal`.
2. **Eliminar uso directo de `supabase.auth.getUser()` en `useAuditoriaRevisiones.ts`**: usar `useAuth()` del contexto para obtener `user.id` y `user.email`, y pasar esos datos al servicio. Resultado: 0 imports de `@/integrations/supabase/client` fuera de `src/services`, `src/contexts/auth` y `src/integrations`.
3. **Bump de versión** a `v8.100.2` y entrada en `Changelog.tsx` documentando ambos puntos.

### A futuro (no actuar ahora)
- Vigilar `src/services/embarque/queries.ts`. Si supera 300 LOC al añadir nuevas relaciones, partir en sub-archivos (`queries/conceptos.ts`, `queries/documentos.ts`, `queries/notas.ts`) bajo el barrel.

## Conclusión

La arquitectura cumple los estándares fijados en memoria del proyecto. Las 2 acciones opcionales toman ~10 minutos y cierran la última fuga arquitectónica. Si prefieres dejarlo aquí, **el código no requiere cambios**.

¿Ejecuto las 2 mejoras opcionales como v8.100.2, o lo dejamos como está?
