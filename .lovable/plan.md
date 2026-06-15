
# Plan de remediación — Módulo Auditoría Operativa

Hallazgos agrupados en **4 bloques** ordenados por impacto. Cada bloque cierra con bump de `APP_VERSION` y entrada en `CHANGELOG.md`. Todos los cambios respetan Power of 10 (≤200 líneas, sin `any`, manejo de error de Supabase).

> **Actualización post-verificación:** la BD confirma que `auditoria_revisiones.organization_id` tiene `DEFAULT current_user_org_id()` y `NOT NULL`, por lo que C-2 baja a HIGH (no produce filas con `NULL`, pero el código sigue siendo frágil ante service-role o cambio futuro del default).

---

## Bloque 1 — Correctness crítico (PR 1)

**Objetivo:** eliminar bugs reales de cálculo y silenciamiento de errores.

1. **C-1 · Paginación en `fetchAuditoriaRevisiones`** — `services/revisiones.ts`
   - Añadir `.limit(5000)` defensivo + nuevo parámetro opcional `{ desdeISO?: string }` que aplica `.gte("created_at", desdeISO)`.
   - Los 3 consumidores (`useAuditoriaRevisiones`, `useAuditoriaCount`, closure en `useAuditoria.ts`) pasarán `desdeISO = now - 90 días` por defecto. Suficiente para cubrir snooze máximo (30d) + ventana de revisados recientes.

2. **C-2 (HIGH) · `organization_id` explícito en upserts** — `services/revisiones.ts`, `services/snooze.ts`
   - Inyectar `organization_id` desde el contexto auth en el payload de upsert. Mantener el default de BD como red de seguridad.
   - Si no hay `organization_id` en sesión, lanzar error en lugar de confiar en el default.

3. **H-1 · Drift UTC** — `domain/ejecutivoAgregados.ts`, `services/snapshots.ts`
   - Reemplazar `setDate/getDate` por aritmética sobre `Date.UTC(...)` o sumar `n * 86_400_000` a `Date.now()`.
   - Reutilizar `isoDate()` ya existente en `core.ts`.
   - Añadir test que cubra el caso de medianoche en CDMX.

4. **H-4 · Edge function `weekly-digest` ignora error de RPC** — `supabase/functions/auditoria-weekly-digest/index.ts:123`
   - Capturar `error` y lanzar/loguear a Sentry vía `captureEdgeException` antes de continuar con la siguiente org.
   - Test unitario que simula error de RPC y verifica que el email NO se envía con cuerpo vacío.

**Validación:** correr suite `src/features/auditoria/**/__tests__/` + edge tests de `auditoria-weekly-digest`.

---

## Bloque 2 — Consistencia UI (PR 2)

**Objetivo:** eliminar discrepancias entre KPIs y tabla.

5. **H-5 + M-1 · Doble filtrado revisados / severidad / modo** — `useAuditoriaPageController.ts` + `AuditoriaHallazgosTab.tsx` + `HallazgosTablaPaginada.tsx`
   - Centralizar filtros en el controller. La tabla recibe `hallazgosFiltrados` ya filtrado y `filtroRevision/severidad/modo` como **props controlados**, no como `initialFilters`.
   - Eliminar los selects duplicados internos de la tabla cuando se renderiza dentro del tab (preservar para usos standalone vía prop `mostrarFiltrosInternos = false`).

6. **H-2 · `useAuditoriaCount` redefine queryFn del mismo key** — `hooks/useAuditoria.ts` + `hooks/revisiones/query.ts`
   - Extraer la queryFn que construye el `Map<string, AuditoriaRevisionRow>` a `revisiones/query.ts` como función exportada `buildRevisionesMap()`.
   - Ambos hooks la usan; React Query queda con una sola definición consistente.

7. **H-3 · Búsqueda solo en `expediente`** — `hooks/hallazgosTablaFilters.ts:33`
   - Ampliar predicado a `[expediente, cliente_nombre, detalle]`.
   - Añadir test en `__tests__` cubriendo búsqueda por cliente y por detalle.

**Validación:** tests + revisión visual en `/auditoria` (filtros, KPIs y tabla deben coincidir siempre).

---

## Bloque 3 — Calidad de métricas (PR 3)

**Objetivo:** que el tablero ejecutivo refleje realidad.

8. **M-2 · Ranking mezcla responsable y revisor** — `domain/ejecutivoAgregados.ts:171`
   - Separar en dos rankings independientes: `rankingResponsables` (por `responsable_email`) y `rankingRevisores` (por `revisado_por_email`).
   - Actualizar `AuditoriaOperadoresCard` para mostrar ambas pestañas o un toggle.

9. **M-3 · MTTR usa `updated_at`** — `domain/ejecutivoAgregados.ts:150-155`
   - Agregar columna virtual `resuelto_at` calculada como `revisado_at` (ya existe en la tabla). Usar esa en lugar de `updated_at`.
   - Si `revisado_at` es null, excluir la revisión del MTTR.

10. **M-6 · `useAuditoriaCount` no expone `isError`** — `hooks/useAuditoria.ts`
    - Retornar `{ data, isLoading, isError, error }`. El badge del sidebar muestra `!` cuando hay error en vez de "0".

**Validación:** tests del dominio + smoke visual en dashboard ejecutivo.

---

## Bloque 4 — Hardening y observabilidad (PR 4)

**Objetivo:** cubrir gaps de tests y monitoreo.

11. **M-4 · Sentry por organización en `snapshot-daily`** — `supabase/functions/auditoria-snapshot-daily/index.ts:58-66`
    - Llamar `captureEdgeException` dentro del catch del loop por-org con tag `{ organization_id }`.

12. **M-5 · Filtro explícito `organization_id` en cliente** — `services/snapshots.ts`
    - Añadir `.eq("organization_id", organizationId)` recibido del `OrganizationContext`. Defensa en profundidad sobre RLS.

13. **L-1 · Tests de edge functions** — `auditoria-snapshot-daily/snapshot_test.ts`, `auditoria-weekly-digest/digest_test.ts`
    - Añadir tests para `processOrg` con: RPC ok, RPC error, org sin admins, email gateway error.

14. **L-3 · SAFE-CAST en `useAuditoriaCount`** — `hooks/useAuditoria.ts:59-64`
    - Añadir guard de schema (zod ligero o validación manual) sobre `results[0].data` antes del cast. Marcar el comentario como `// SAFE-CAST: validado por <guard>`.

15. **L-4 · Consistencia `REGLA_INFO.shortLabel` vs `reglaShortLabel()`** — `reglaLabels.test.ts`
    - Test que itera todas las reglas y verifica que ambos coinciden.

**Validación:** suite completa de tests + lint + revisión del `audit-report.md`.

---

## Detalles técnicos

### Archivos editados por bloque

```text
Bloque 1: 4 archivos src + 1 edge function + 2 tests nuevos
Bloque 2: 5 archivos src + 1 test nuevo
Bloque 3: 3 archivos src + 1 componente UI + 2 tests
Bloque 4: 4 archivos src + 2 archivos de test edge + 1 test dominio
```

### Compatibilidad

- C-1 introduce parámetro **opcional** → 0 cambios en llamadas existentes.
- H-5/M-1 cambia firma de props de `HallazgosTablaPaginada` → agregar prop opcional con default que preserva el comportamiento standalone.
- M-2 agrega un campo nuevo en el resultado del agregado → consumidores existentes siguen funcionando (solo añaden uso opcional).

### Riesgos

- **Bloque 2** toca el flujo de filtros: requiere validación visual cuidadosa en `/auditoria`.
- **Bloque 3 punto 9 (M-3)** puede cambiar valores históricos de MTTR mostrados; documentar en CHANGELOG.

### Versionado

Cada bloque = un bump de versión PATCH:
- Bloque 1 → 13.21.22
- Bloque 2 → 13.21.23
- Bloque 3 → 13.21.24
- Bloque 4 → 13.21.25

### Fuera de alcance

- L-2 (`useAutoCapturarSnapshot` sin cancel flag): riesgo bajo, sin canal realtime. Se deja sin tocar.
- Refactor mayor de `HallazgosTablaPaginada` para deduplicar con `HallazgoTabla`: no es bug, solo deuda técnica.

---

## Recomendación de ejecución

Implementar **bloques 1 y 2 ahora** (impacto alto, riesgo bajo). Bloques 3 y 4 después de validar que la UI sigue funcionando correctamente en `/auditoria`.
