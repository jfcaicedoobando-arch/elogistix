
# Sprint A — Cierre (CRM 11.3.x)

Continuamos con los 3 puntos pendientes que dejamos listos a nivel de hooks pero sin UI.

## 1. Linaje visible en detalles (Lead → Oportunidad → Cotización → Embarque)

- En `src/pages/crm/LeadDetalle.tsx`: agregar tarjeta "Oportunidades generadas" listando oportunidades cuyo `lead_id` coincide, con link a `/crm/oportunidades/:id`.
- En `src/pages/crm/OportunidadDetalle.tsx`: agregar tarjeta "Origen y conversiones":
  - Link al lead origen (si `lead_id` existe).
  - Cotizaciones vinculadas (`cotizaciones` por `oportunidad_id` si existe la columna; si no, por `cliente_id` filtrado por fecha posterior a creación de la oportunidad) con link a `/cotizaciones/:id`.
  - Embarques vinculados (vía cotización → embarque) con link a `/embarques/:id`.
- Reusar `useCotizaciones` / `useEmbarques` existentes; no nuevas tablas.

## 2. Badges de actividades vencidas

- En `src/pages/crm/CrmLayout.tsx`: leer `useActividadesVencidasCount()` y mostrar badge rojo junto al tab "Actividades" cuando `count > 0`.
- En `src/components/layout/sidebarItems.ts` / componente que renderiza el item "CRM": mostrar el mismo badge junto al icono cuando `count > 0` (sólo para roles con `canEditCrm`).
- Badge: pill `bg-destructive text-destructive-foreground` con el número (99+ si excede).

## 3. Acciones inline en lista de actividades

En `src/pages/crm/Actividades.tsx` (y la tabla que use), agregar por fila:
- Botón "Completar" → `useCompletarActividad` (ya existe o se añade mínimo wrapper sobre update `estado='completada'`, `completada_en=now()`).
- Menú "Posponer" con opciones rápidas (+1h, +1 día, mañana 9am, +1 semana) usando `usePosponerActividad` ya creado.
- Toast de confirmación + invalidación de queries (`actividades`, `actividades-vencidas-count`, `crm-dashboard`).
- Respetar `e.stopPropagation()` en los botones para no disparar el row click.

## Versionado y changelog

- Bump `APP_VERSION` a `11.3.1`.
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` describiendo: linaje visible, badges de vencidas, acciones rápidas en actividades.

## Detalles técnicos

- Sin cambios de schema. Todo se resuelve con queries existentes.
- Si `cotizaciones.oportunidad_id` no existe, se omite ese vínculo y se documenta en notas para Sprint C (ya está en el roadmap como "mejor pre-fill de cotización").
- Cumplir Power of 10: componentes ≤200 líneas (se extraen `LineageCard`, `ActividadRowActions`), sin `any`, cleanup en effects, manejo de `error` de Supabase.
- Permisos: acciones inline sólo visibles si `canEditCrm`.

¿Procedo con la implementación?
