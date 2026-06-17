## Próximo bloque de la auditoría (hallazgos restantes 4, 11, 12, 14)

Avanzamos con el resto del bloque Alto/Medio. Sin cambios de UI ni de reglas de negocio: solo tests, mover archivos y dividir hooks/rutas grandes.

### Paso 4 — Cobertura en `operaciones` y `reportes` (🟠 Alto)
- `src/features/operaciones/services/__tests__/index.test.ts` — mockear `supabase.rpc("operaciones_stats")` y validar:
  - Propaga error de Supabase.
  - Mapea `fromDb` correctamente (forma de `ServerStats`).
  - Devuelve estructura vacía coherente cuando `data` viene sin operadores.
- `src/features/reportes/services/__tests__/*.test.ts` — un test por servicio existente cubriendo: shape de retorno, filtro por organización y manejo de error.
- Añadir un test de hook (`usePresupuestoVsReal` o equivalente del módulo de reportes) usando `queryWrapper`.

### Paso 11 — Reubicar `src/components/shared/utils/` (🟡 Medio)
Mover los 10 archivos no-componente a su lugar correcto y actualizar imports:
- `auditoriaConfig`, `estadoConfig`, `kpiTones`, `uiMappings`, `errorReportFormat` → `src/lib/ui/`
- `authSnapshot*`, `errorDetailsStore` → `src/lib/auth/` y `src/lib/diagnostics/`
- Mantener barrel de compatibilidad en `src/components/shared/utils/index.ts` re-exportando desde la nueva ubicación para no romper imports legacy en un solo PR.

### Paso 12 — Dividir `useCotizacionesPageController.ts` (🟡 Medio)
Extraer tres hooks especializados en `src/features/cotizaciones/hooks/`:
- `useCotizacionFilters` — estado y debounce de búsqueda/estado/fechas.
- `useCotizacionPagination` — page/pageSize y reset al cambiar filtros.
- `useCotizacionActions` — duplicar, enviar, archivar, exportar.
- `useCotizacionesPageController` queda como **composer** ≤80 líneas que ensambla los tres.
- Tests unitarios por hook nuevo.

### Paso 14 — Rutas de Costeo (🟡 Medio)
- `src/features/costeo/routes/CosteoTarifas.tsx` y `CosteoRutas.tsx`: extraer el cuerpo del formulario a `src/features/costeo/components/CosteoTarifasForm.tsx` y `CosteoRutasForm.tsx`.
- Las rutas quedan ≤30 líneas: solo layout + render del form + hooks de datos.

### Lo que NO se toca en este PR
- Pasos 8 (paginación restante), 10 (tokens semánticos restantes), 15, 16 y 17–20 quedan para un siguiente bloque acotado por área.

### Metadatos
- Bump `APP_VERSION` → `13.56.4` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` describiendo: tests `operaciones`/`reportes`, reubicación `shared/utils`, split de `useCotizacionesPageController`, extracción de forms de costeo.

### Riesgo
Bajo: tests aislados, movimientos con barrel de compatibilidad y composición de hooks sin cambiar firmas públicas.
