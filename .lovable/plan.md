## Siguiente bloque de remediación (hallazgos 10, 11, 15, 16)

Ya cerramos 4, 8, 12 y 14. Continuamos con los pendientes de severidad Media, sin cambios funcionales ni de UI.

### Paso 10 — Tokens semánticos restantes (🟡 Medio)
Auditar y reemplazar colores hardcodeados (`text-white`, `bg-black`, `text-gray-*`, `bg-[#...]`) por tokens semánticos del design system en:
- `src/pages/profit/*` (ProfitDashboardEjecutivo, ProfitEstadoResultados, ProfitPresupuesto, ProfitProyeccion)
- `src/pages/tesoreria/TesoreriaFlujo.tsx`
- `src/pages/bandejas/*` (Cartera, CxpPorCapturar, CxpPorPagar, FacturacionPorEmitir)
- `src/components/dashboard-ejecutivo/*`

Reglas: usar `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`, y los tokens semánticos ya definidos en `index.css` / `tailwind.config.ts`. No introducir nuevos tokens en este paso.

### Paso 11 — Reubicar `src/components/shared/utils/` (🟡 Medio)
Mover los 10 archivos no-componente a su ubicación correcta, conservando barrel de compatibilidad:
- `auditoriaConfig.ts`, `estadoConfig.ts`, `kpiTones.ts`, `uiMappings.ts`, `errorReportFormat.ts` → `src/lib/ui/`
- `authSnapshotBuilder.ts`, `authSnapshot*.ts` → `src/lib/auth/`
- `errorDetailsStore.ts` → `src/lib/diagnostics/`
- `src/components/shared/utils/index.ts` queda como barrel re-exportando desde las nuevas rutas (no se rompen imports existentes).
- Sin cambios en firmas ni en lógica.

### Paso 15 — Composición de `TabCierre.tsx` (🟡 Medio)
- Extraer subcomponentes presentacionales (`CierreResumenCard`, `CierreAccionesFooter`) a `src/features/embarques/components/cierre/`.
- `TabCierre.tsx` queda ≤150 líneas, solo orquestación + hook `useCierreDialog`.
- Sin cambios en estado ni en reglas de negocio.

### Paso 16 — Tests del módulo `presupuesto` (🟡 Medio)
- `src/features/presupuesto/services/__tests__/categorias.test.ts` — CRUD + `seedCategoriasDefault` (mock RPC).
- `src/features/presupuesto/services/__tests__/mensual.test.ts` — `fetchPresupuestoMensualAnio` (rango + límite 500) y `upsertCeldaPresupuesto` (onConflict correcto).
- `src/features/presupuesto/hooks/__tests__/usePresupuestoVsReal.test.ts` — usando `queryWrapper`, valida `enabled` por `periodo` y shape del retorno.

### Lo que NO se toca
- Hallazgos 17–20 quedan para el siguiente bloque (mover comentarios de auditoría a temas dedicados).

### Metadatos
- Bump `APP_VERSION` → `13.56.6` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` describiendo los pasos 10, 11, 15 y 16.

### Riesgo
Bajo: solo movimientos con barrel de compatibilidad, tokens visuales equivalentes, extracción de presentacionales y tests aislados.
