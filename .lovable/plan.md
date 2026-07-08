
# Adelgazar tab Conciliación (evitar solape con Costos)

## Objetivo
El nuevo tab **Costos** ya cubre cotizado-vs-facturado por concepto. El tab **Conciliación** conserva únicamente lo que no vive en Costos: la comparación tripartita con la tarifa vigente y el rastro de decisión de tarifa.

## Cambios

### `src/features/embarques/components/TabConciliacion.tsx`
Quitar:
- La **tabla "Cotizado vs Real por concepto (facturas proveedor)"** completa (líneas 139-158) — duplica lo que ya muestra la tabla agrupada por proveedor en el tab Costos.
- La grilla de **4 KPIs** de Total Cotizado / Total Real / Desviación / Sin factura (líneas 95-108 y 128-137) — los totales ya viven en Costos y los KPIs macro en el header del embarque.
- Los helpers `colorDesviacion` y `fmtPct` si dejan de usarse tras la limpieza; se conservan sólo si `ReconciliacionTresColumnas` los reutiliza (a verificar al editar).
- El import de `DataTable`, `defineColumns`, `useMemo`, `formatCurrency`, `toTitleCase`, `Scale`, `EmptyState`, `calcularResumen`, `FilaReconciliacion` que ya no se usen (limpieza de imports).

Conservar / reordenar (queda así el tab):
1. Banner **"Decisión aplicada"** (tarifa: sin_cambios / mantenida / refrescada / sustituida / re-aprobada por ventas) — sin cambios en su contenido.
2. Carta **Reconciliación 3 columnas (Cotizado · Refrescado · Real)** con el componente `ReconciliacionTresColumnas` — sin cambios.
3. Se agrega una línea de ayuda al final: "El detalle por proveedor y facturas ligadas está en la pestaña **Costos**." con enlace que cambia `activeTab` a `costos` (o simple hint textual si el componente no recibe el setter — en ese caso se deja sólo el texto). Nota: como `TabConciliacion` sólo recibe `embarqueId`, se implementa como texto plano sin navegación programática para no alterar contratos.

### Sin cambios en:
- `EmbarqueDetalleTabs.tsx` — el tab sigue existiendo con el mismo id `conciliacion`.
- Hook `useReconciliacionEmbarque` — sigue usado por el tab Costos y por `ReconciliacionTresColumnas` internamente.
- Módulo global de Conciliación en Compras (`/compras/conciliacion`) — fuera de alcance.

### Versionado + changelog
- Bump `APP_VERSION` → `13.216.1` (patch, sólo poda visual).
- Entrada en `CHANGELOG.md` explicando la simplificación y por qué (evitar duplicidad con el tab Costos).

## Fuera de alcance
- No se elimina el tab ni se renombra.
- No se toca la lógica de `ReconciliacionTresColumnas`.
- No se cambian los KPIs superiores del detalle de embarque.

## Verificación
- `bunx tsgo --noEmit` limpio.
- Tests existentes de `reconciliacionCostos.*` siguen pasando (no dependen del componente).
- Chequeo visual en `/embarques/:id?tab=conciliacion`: el tab queda con banner + carta 3 columnas + hint.
