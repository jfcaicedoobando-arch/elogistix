## Remediación Visual — Batches 2, 3 y 4

Continuamos con los lotes restantes del plan aprobado. Tras Batch 1 (Facturación + CRM ya corregidos), seguimos con tablas, componentes y pulido final.

### Batch 2 — Tablas y Headers

1. **Tabla de Embarques**: ajustar anchos de columna fijos para evitar truncado de Cliente/Ruta en 1920×1080. Usar `min-w` semánticos en `EmbarquesTable.tsx`.
2. **Cotizaciones**: alinear pesos de CTAs (botón primario "Nueva cotización" más prominente; secundarios en `variant="outline"` consistente).
3. **Inicio (Dashboard)**: estandarizar padding (`p-6`) y sombras (`shadow-sm`) en cards del dashboard para coherencia con resto de la app.
4. **Auditoría**: tipografía de métricas (`text-2xl font-semibold tabular-nums`) consistente con `KpiStrip`.

### Batch 3 — Componentes compartidos

5. **Tabs**: unificar a variante "underline" en módulos que aún usan estilo "pill" (Embarques detalle ya OK; revisar CXP y Facturación).
6. **CXP filtros**: alinear barra de filtros al patrón de Embarques (mismo orden: búsqueda → selectores → fechas → acciones).
7. **Clientes**: aplicar `max-w-sm` al input de búsqueda para evitar que se estire en pantallas amplias.
8. **Badges**: vocabulario consistente — estados terminales (Cerrado, Pagado, Cancelado) en `filled`; estados intermedios (Pendiente, En curso) en `outline`.

### Batch 4 — Pulido final

9. **PageHeader migration**: migrar las 30 rutas que todavía usan `<h1>` crudo al componente `PageHeader` con title + subtitle estandarizados. Lista priorizada por tráfico (Inicio, Embarques, Cotizaciones, CXP, Facturación primero).
10. **Topbar search**: aumentar contraste del placeholder (`text-muted-foreground/80`) y borde sutil para visibilidad en fondo claro.
11. **Enterprise badge**: estilo consistente (gradiente sutil + ícono) en sidebar y settings.

### Validación

- Recapturar screenshots en 1920×1080 después de cada batch.
- Sub-agente de auditoría visual valida diff antes de cerrar batch.
- Bump de versión por batch (`13.139.15`, `.16`, `.17`).
- Actualizar `CHANGELOG.md` con resumen por batch.

### Orden de ejecución sugerido

Batch 2 → recaptura → Batch 3 → recaptura → Batch 4 (migración masiva PageHeader al final porque toca más archivos).

¿Procedo con Batch 2 primero, o prefieres reordenar / saltar algún punto?
