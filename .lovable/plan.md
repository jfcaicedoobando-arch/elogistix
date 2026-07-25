
## Ola 2 · Performance PR 3 (P11 → P16)

Ola 0 (P1–P6), P7 y P8–P10 ya están cerradas en `13.317.x`. Este PR aborda los 6 ítems de Ola 2 en orden, un commit lógico por ítem.

### Analogía
Ya tenemos las gavetas ordenadas (Olas 0–1). Ahora sacamos del cajón lo que nunca se usa: doble render móvil/desktop, PDF cargado por si acaso, triggers que suman dos veces, dashboards que descargan medio archivero para hacer una suma, etc.

---

### P11 · `ResponsiveDataTable`: una sola rama montada
- Editar `src/components/shared/ResponsiveDataTable.tsx`: reemplazar `hidden sm:block` / `sm:hidden` por `useIsMobile()` de `@/hooks/shared` y renderizar `isMobile ? <TarjetasMovil/> : <TablaDesktop/>`.
- Mantener props y estilos intactos; solo cambia el DOM montado.
- Ajustar tests que asumían ambas ramas (mockear `matchMedia` igual que en tests de sidebar).

### P12 · `@react-pdf/renderer` bajo demanda
- Buscar imports estáticos: `rg "@react-pdf/renderer" src/` y los `Document` de cada feature (Cxp, Profit, cotización).
- Mover generación al handler:
  ```ts
  const [{ pdf }, doc] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ComponentePdf"),
  ]);
  const blob = await pdf(createElement(doc.default, props)).toBlob();
  ```
- Estado "Generando PDF…" en botones; manejar errores con `notifyError`.

### P13 · Trigger `recalcular_estado_factura`: dedupe SUMs ⚠️
- Migración `CREATE OR REPLACE` del trigger con la MISMA firma y máquina de estados: calcular `total_pagado` en variable local, reutilizar para el estado (no llamar `saldo_factura` dos veces).
- **Bloqueante:** correr `supabase/tests/*guard_estado_factura*.sql` y `cxc_guard_sobrepago.sql` verdes. Añadir regresión: pago exacto → Pagada; parcial → Parcial; borrado lógico de pago → recálculo.

### P14 · KPIs de dashboards server-side
- Migración con RPCs:
  - `dashboard_direccion_kpis(p_desde, p_hasta)` — conteos/sumas por estado.
  - `facturacion_tendencia_6m()` — GROUP BY mes.
  - `crm_resumen_abiertas()` — conteos por etapa.
- Reemplazar loaders correspondientes (`dashboardDireccion/loaders.ts`, `dashboardEjecutivo/services/dashboardEjecutivo.ts`, CRM) por llamadas a los RPCs con mapper delgado que preserve shape.
- Quitar `.in("embarque_id", ids)` masivo.

### P15 · Cotizaciones paginada + Proformas sin `select("*")`
- `src/features/cotizacion/services/queries.ts`: server-side pagination `page/pageSize=50` con `count: "exact"`. Replicar patrón Embarques.
- `src/features/proformas/services/queries.ts`: sustituir `select("*")` por columnas explícitas, joins acotados, paginación 50.
- Actualizar hooks/controllers y `queryKeys` del feature.

### P16 · Wizard cotización: `watch` acotado
- `CotizacionWizardSteps.tsx`: cambiar los 8 `form.watch()` globales por `useWatch({ control, name })` por campo.
- En `FormularioNuevoProspecto`, `NoMaritimoFields`, `OrigenDestinoBlock`: donde solo se lee una vez, usar `getValues()` dentro del handler.

---

### Versionado
- `APP_VERSION` → `13.318.0` al cierre de la ola.
- CHANGELOG: un bullet por ítem P11–P16 bajo la misma versión.

### Verificación por ítem
- Lint `--max-warnings 0`, tsgo, vitest y `audit:arch` verdes.
- P13: tests SQL de guards obligatorios verdes antes de mergear.
- P11/P14/P15: comprobar en DevTools que el DOM/red baja según el criterio del roadmap.
- P12: red no incluye `react-pdf` al montar Cxp/Profit; sí al hacer click en descargar.

### Riesgos
- **P13** toca dinero: si algún guard SQL falla, se revierte solo ese ítem y se documenta.
- **P14**: shape de KPIs debe preservarse — mappers con tests para evitar regresión visual.
- **P15**: paginar cotizaciones puede requerir mover filtros a servidor; si no cabe en el alcance, se mantiene búsqueda client-side sobre página actual con nota.

### Fuera de alcance
- P17–P20 (Ola 3, higiene) — irán en el siguiente PR.
- Export CSV completo en bandejas paginadas (queda como TODO abierto de P7).
