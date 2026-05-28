## v12.14.3 — Cierre regresiones arquitectónicas

Limpiar las 3 violaciones de arquitectura (hooks con import directo a Supabase) detectadas en `reports/audit-report.md` v12.14.1. Mover I/O a la capa `services/*` para volver al baseline limpio (0 violaciones).

### 1. `useContenedoresInfoMap` (regresión introducida en 12.14.1)
- Crear `src/services/embarque/contenedores/fetchInfoMap.ts` con `fetchContenedoresInfoMap(embarqueIds: string[]): Promise<ContenedoresInfoMap>` que encapsule el `select` + el conteo de `incompletos`.
- Exportar desde `services/embarque/contenedores/index.ts`.
- `useContenedoresInfoMap.ts` deja sólo el `useQuery` y delega a `fetchContenedoresInfoMap`. Mantener la misma key y `staleTime`.

### 2. `useCrmProspectoSearch`
- Verificar si `services/crm/search.ts` ya cubre la búsqueda combinada lead+oportunidad. Si sí, reusarlo; si no, extraer la query a `services/crm/prospectoSearch.ts` con firma `searchProspectos(term: string): Promise<...>`.
- Hook queda sólo con `useQuery` + debounce ya existente.

### 3. `handlePaso1Crm`
- No es realmente un hook (es helper). Su import a Supabase debe moverse a un service nuevo `services/cotizacion/wizard/paso1Crm.ts` (o reusar uno existente en `services/cotizacion/wizard.ts`).
- El helper original sólo orquesta la validación y llama al service.

### 4. Verificación
- Re-ejecutar `bun run audit:arch` y `bun run audit:report`.
- Esperado: sección "Hooks/Contexts con import directo a Supabase" → ✅ Ninguno.
- Commit del reporte regenerado.

### Detalles técnicos
- Sin migraciones SQL.
- Mantener la API pública de los hooks intacta para no romper llamadores.
- Sin tests nuevos (los services se exponen como I/O puro, ya cubiertos indirectamente por los componentes que los consumen).
- Si algún hook crece >200 líneas al refactor (no debería), partir en sub-archivos siguiendo Power of 10.

### Entregables
1. `services/embarque/contenedores/fetchInfoMap.ts` + hook refactor.
2. Service nuevo o reusado para `prospectoSearch` + hook refactor.
3. Service nuevo para `paso1Crm` + helper refactor.
4. `reports/audit-report.{md,json}` regenerados → 0 violaciones arch.
5. `CHANGELOG.md` `## [12.14.3]` + bump `APP_VERSION`.

### Out of scope
- Bajar los 5 archivos >200 líneas (queda para 12.15.x).
- Atacar los 5 casts HIGH restantes (queda para revisión caso por caso).
- Migrar la RPC de auditoría para dejar de leer columnas legacy de `embarques`.
