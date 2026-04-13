

## Compactación v8.8.0 — Últimas oportunidades

El codebase está en estado muy limpio. Solo quedan **micro-optimizaciones de consistencia** y una utilidad repetida en 7+ lugares.

---

### Hallazgos

#### 1. MEDIO — Patrón `origen/destino` duplicado en 7+ archivos (14 ocurrencias)

La expresión `e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—"` se repite textualmente en 7 archivos. Debería ser una función utilitaria en `formatters.ts`.

**Solución**: Crear `getOrigen(e)` y `getDestino(e)` en `src/lib/formatters.ts` y reemplazar todas las ocurrencias.

**Archivos afectados**: `Embarques.tsx`, `PortalDashboard.tsx`, `EmbarquesActivosTable.tsx`, `EmbarqueCard.tsx`, `clienteColumns.tsx`, `TrackingPublico.tsx`

---

#### 2. BAJO — `PortalDashboard.tsx` (317 líneas) tiene 4 secciones inline

Las secciones de KPIs, estado de embarques, próximos arribos y facturación pendiente son auto-contenidas y podrían extraerse a sub-componentes para mejorar legibilidad.

**Solución**: Opcional — solo extraer si crece más. Marcar como no-acción por ahora.

---

#### 3. BAJO — `useOperacionesData.ts` (324 líneas) — sin cambio

Ya se identificó en la auditoría anterior como opcional. Solo actuar si crece.

---

### Plan de acción

| Paso | Descripción | Impacto |
|------|------------|---------|
| 1 | Crear helpers `getOrigen`/`getDestino` en `formatters.ts` y reemplazar en 6 archivos | Elimina 14 líneas duplicadas, mejora mantenibilidad |
| 2 | Actualizar `changelogData.ts` con entrada v8.8.0 | Documentación |

### Resumen

Solo queda **1 acción concreta** de valor. El resto del codebase ya está en estado óptimo de producción. Después de este paso, no hay más oportunidades significativas de compactación sin reestructurar la arquitectura.

