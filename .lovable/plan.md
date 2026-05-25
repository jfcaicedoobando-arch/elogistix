# Plan — CRM v11.48.0: Cierre de ciclo (B) + Next Best Actions (D)

Implementa los dos bloques de mayor ROI inmediato del análisis previo, sin migraciones de esquema mayores. Sólo se agregan **2 columnas** opcionales en `crm_oportunidades` y **1 trigger**.

---

## Bloque B — Cierre automático del ciclo

### Objetivo
Que cuando una cotización vinculada a una oportunidad se acepte o se convierta en embarque, la oportunidad se mueva sola a "Ganada" con fecha y monto reales. Y que el vendedor vea claramente qué cotizaciones llevan días sin respuesta del cliente.

### Cambios de datos (migration)
1. `crm_oportunidades`: agregar columnas opcionales
   - `cotizacion_ganadora_id uuid` (referencia lógica a `cotizaciones.id`)
   - `embarque_ganador_id uuid` (referencia lógica a `embarques.id`)
2. `crm_etapas_pipeline`: helper SQL `get_etapa_ganada(org_id)` que devuelve la primera etapa `tipo='ganada'`.
3. Trigger `trg_cotizacion_cierra_oportunidad` en `cotizaciones`:
   - Si `NEW.oportunidad_id IS NOT NULL` y `NEW.estado` pasa a `'Aceptada'` o `'En operación'`, y la oportunidad sigue en etapa `abierta`:
     - Mover oportunidad a etapa ganada (de la propia org).
     - `probabilidad = 100`, `fecha_cierre_real = CURRENT_DATE`, `valor_real = NEW.subtotal`, `cotizacion_ganadora_id = NEW.id`.
     - Si `NEW.embarque_id IS NOT NULL`, también `embarque_ganador_id = NEW.embarque_id`.
   - Insertar fila en `bitacora_actividad` (módulo `crm`, acción `oportunidad_ganada_auto`).
   - Insertar `crm_notificaciones` para el `vendedor_id` de la oportunidad.

### Cambios de UI
- `OportunidadDetalle.tsx`: si la oportunidad tiene `cotizacion_ganadora_id` / `embarque_ganador_id`, mostrar un banner verde "Ganada con cotización FOLIO → embarque FOLIO" con links.
- `OportunidadCotizacionesList.tsx`: badge "Esperando respuesta · N días" cuando `estado = 'Enviada'` y `created_at` > 5 días.
- Nueva card en Inicio del CRM (`CrmDashboard`): **"Cotizaciones sin respuesta > 5 días"** (top 5, link al detalle). Va junto a `CerrandoSemanaCard`.
- Nuevo hook `useCotizacionesSinRespuesta(diasUmbral=5)` en `hooks/crm/`.

---

## Bloque D — Next Best Actions para el vendedor

### Objetivo
Que al entrar a `/crm` el vendedor vea 5 acciones priorizadas para hacer ahora, sin tener que recorrer 4 pantallas para decidir.

### Reglas de priorización (puras, testables)
Nuevo archivo `src/lib/crm/nextBestActions.ts` con función `computeNextBestActions(input)` que toma: leads, oportunidades, actividades, cotizaciones, etapas. Devuelve hasta 5 items ordenados por score:

| Regla | Score | Mensaje |
|---|---|---|
| Lead nuevo sin contactar > 24h | 100 | "Contactar a {empresa} — lleva {h}h sin atención" |
| Cotización enviada sin respuesta > 5 días | 90 | "Dar seguimiento a cotización {folio} de {cliente}" |
| Oportunidad con cierre estimado en ≤ 3 días y sin actividad reciente | 85 | "Cerrar {nombre} — fecha estimada {fecha}" |
| Oportunidad sin actividad > 7 días | 70 | "{nombre} lleva {d} días sin movimiento" |
| Actividad vencida | 60 | "Completar: {asunto}" |

Cada item: `{ id, regla, titulo, subtitulo, href, score, icono }`.

### Cambios de UI
- Nuevo componente `src/components/crm/crmDashboard/NextBestActionsCard.tsx`. Va arriba del todo en `CrmDashboard`, encima de `VencidasAlert`.
- Cada fila: icono + título + subtítulo + botón "Ir →". Hover con sombra suave.
- Tests unitarios en `src/lib/crm/__tests__/nextBestActions.test.ts` cubriendo las 5 reglas y el orden por score.

### Hook
`useNextBestActions()` en `hooks/crm/`: combina datos ya cargados (reutiliza `useCrmDashboardData` + nuevo `useCotizacionesSinRespuesta` + leads sin contactar) y aplica `computeNextBestActions`.

---

## Detalles técnicos

**Archivos nuevos**
- `supabase/migrations/<timestamp>_crm_cierre_ciclo.sql`
- `src/lib/crm/nextBestActions.ts` + test
- `src/components/crm/crmDashboard/NextBestActionsCard.tsx`
- `src/components/crm/crmDashboard/CotizacionesSinRespuestaCard.tsx`
- `src/hooks/crm/useCotizacionesSinRespuesta.ts`
- `src/hooks/crm/useNextBestActions.ts`
- `src/services/crm/cotizacionesSinRespuesta.ts`

**Archivos editados**
- `src/pages/crm/CrmDashboard.tsx` — insertar NBA card y "cotizaciones sin respuesta"
- `src/hooks/crm/useCrmInicioVM.ts` — exponer nuevos datos
- `src/pages/crm/OportunidadDetalle.tsx` — banner de ganada
- `src/components/crm/OportunidadCotizacionesList.tsx` — badge días sin respuesta
- `src/hooks/crm/index.ts` — barrel
- `src/constants/appVersion.ts` → `11.48.0`
- `CHANGELOG.md` — entrada `[11.48.0]`

**Fuera de alcance**
- Cadencias/secuencias automáticas (D avanzado).
- Modalidad/lane/commodity en oportunidades (bloque A — requiere otra migración).
- Vista del supervisor (bloque C).
- Email/WhatsApp inbox.

**Compatibilidad**
- Las nuevas columnas son nullable; oportunidades existentes no se tocan.
- El trigger sólo dispara cuando hay `oportunidad_id` y la etapa actual es `abierta`, así que oportunidades ya cerradas a mano no se sobrescriben.
