
# Mejoras al Módulo de Auditoría Operativa

## Diagnóstico actual

El módulo es **sólido como inspector operativo** (detecta hallazgos por 4 reglas, permite filtrar, marcar revisado con bitácora y badge en sidebar). Pero hoy está pensado para el **operador de tráfico**, no para el **director general**. Le faltan tres cosas clave:

1. **Visión ejecutiva**: solo muestra hallazgos crudos. No hay tendencia, ranking de responsables, ni indicadores de salud operativa.
2. **Accionabilidad**: marcar "revisado" es un paso, pero no se asigna a nadie, no tiene fecha límite, ni se mide tiempo de resolución (MTTR).
3. **Cobertura de reglas**: las 4 reglas actuales cubren docs/fechas/facturación, pero no rentabilidad, márgenes, demoras de proveedor, ni cumplimiento financiero.

---

## Plan de mejora — 3 fases

### Fase 1 — Vista Ejecutiva (Director General)

**Nueva pestaña "Resumen ejecutivo"** (default cuando entra el director), enfocada en salud operativa y tendencia, no en hallazgos individuales.

- **Score de salud operativa** (0-100): % de embarques activos sin hallazgos críticos, ponderado por severidad. Big number con flecha vs. semana anterior.
- **Tendencia 30 días**: línea de hallazgos por severidad/día (recharts) — ¿estamos mejorando o empeorando?
- **Top 5 clientes con más hallazgos** y **Top 5 operadores responsables** (ranking accionable).
- **Distribución por etapa del embarque** (barras): ¿dónde se concentran los problemas? (Confirmado / En Tránsito / En Aduana / Entregado).
- **MTTR — Tiempo medio de resolución**: días promedio entre detección y "marcado revisado", desglosado por severidad.
- **Hallazgos sin atender > 7 días** (alerta roja con CTA "Asignar responsable").

### Fase 2 — Accionabilidad y workflow

Convertir cada hallazgo en una **tarea con dueño y deadline**:

- **Asignar responsable** a un hallazgo (dropdown con miembros de la organización). Email/notificación opcional.
- **Fecha límite de resolución** (con badge "vencido" en rojo).
- **Estados**: Pendiente → En proceso → Revisado → (opcional) Reabierto.
- **Comentarios/historial**: hilo de notas en el dialog de revisión, no solo "acción tomada" único.
- **Vista "Mis hallazgos asignados"** (filtro rápido en chip).
- **Reasignar / escalar**: botón para escalar a supervisor si lleva > N días.
- **Snooze**: posponer hallazgo N días con justificación (útil para esperar respuesta de cliente/agente).

### Fase 3 — Nuevas reglas de auditoría (RPC backend)

Ampliar `auditoria_embarques_org` con reglas que el director realmente quiere ver:

- **`margen_bajo`**: embarques con utilidad < umbral configurable (ej. < 5%) o **margen negativo**. Severidad crítica si pierde dinero.
- **`venta_sin_costo`**: embarques con ingresos registrados pero sin costos asociados (riesgo de margen falso).
- **`costo_sin_venta`**: costos cargados sin concepto de venta correspondiente (fugas).
- **`proforma_vencida`**: proformas emitidas > 30 días sin pago/factura.
- **`demora_proveedor`**: ETA real vs. ETA estimada > X días, con desglose por naviera.
- **`embarque_huérfano`**: sin operador asignado, sin tracking actualizado en > 5 días.
- **`tipo_cambio_desactualizado`**: embarques cerrados con TC distinto al del día.
- **`cliente_sin_contacto_principal`** o sin documentos onboarding completos.

Cada regla con su severidad, configurable desde Configuración (umbrales por org).

---

## Mejoras transversales (todas las fases)

- **Exportar a CSV/Excel** (botón en toolbar) — usar `src/generators/exportCsv.ts`. Filtros aplicados se respetan.
- **Reporte semanal por email** (edge function `auditoria-weekly-digest` con cron): resumen ejecutivo a directores cada lunes.
- **Snapshot histórico**: nueva tabla `auditoria_snapshots` que guarda el conteo diario por regla/severidad/cliente para alimentar la tendencia 30d sin recalcular.
- **Drill-down desde KPIs**: clic en "Críticos" filtra automáticamente la tabla.
- **Permisos por rol**: el director solo ve la pestaña ejecutiva por default; operadores ven la operativa. Rol `auditor` opcional.
- **Búsqueda extendida**: hoy solo busca por expediente. Agregar cliente, detalle, regla.

---

## Detalles técnicos

### Backend (Supabase)
- Ampliar `public.auditoria_embarques_org()` con nuevas reglas (CTEs adicionales).
- Tabla `public.auditoria_revisiones` — agregar columnas: `responsable_id uuid`, `fecha_limite date`, `estado text`, `prioridad text`.
- Nueva tabla `public.auditoria_comentarios` (hilo por revisión).
- Nueva tabla `public.auditoria_snapshots` (rollup diario para tendencia).
- Nueva tabla `public.auditoria_config_org` (umbrales por organización: margen mínimo, días demora, etc.).
- Edge function `auditoria-weekly-digest` (Resend o equivalente).
- pg_cron job nocturno para snapshot.

### Frontend
- Nueva ruta/tab `/auditoria?tab=ejecutivo` con `AuditoriaEjecutivoTab.tsx`.
- Componentes nuevos: `AuditoriaScoreCard`, `AuditoriaTendenciaChart`, `TopClientesHallazgos`, `MTTRCard`, `DistribucionPorEtapaChart`.
- Dialog de revisión evoluciona: agrega selector de responsable, fecha límite, hilo de comentarios.
- Hooks nuevos en `src/hooks/auditoria/`: `useAuditoriaSnapshots`, `useAuditoriaTendencia`, `useAuditoriaConfig`, `useAsignarHallazgo`.
- Service `src/services/auditoria/index.ts` ampliado.

### Versionado
- Bump a **v8.101.0 (MINOR)** — feature significativa, no breaking.
- Entrada en `Changelog.tsx` y `src/content/changelog/v8/chunks/`.

---

## Recomendación de orden

Sugiero arrancar con **Fase 1 (Vista Ejecutiva)** porque:
- Es lo que más rápido le da valor al director general.
- Reusa los datos que ya existen (no requiere cambios pesados de schema).
- Hace evidente el valor del módulo y motiva la inversión en Fase 2/3.

Después Fase 3 (nuevas reglas) y por último Fase 2 (workflow de asignación), que es la más invasiva en schema.

---

## Pregunta para continuar

¿Quieres que arranque con **Fase 1 completa** (vista ejecutiva con score, tendencia, top clientes, MTTR), o prefieres que haga una versión MVP con solo score + tendencia + top clientes y vamos iterando?
