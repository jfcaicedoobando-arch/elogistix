## Objetivo

Quitar el botón "Resolver" del checklist de cierre y hacer que **toda la fila del check** sea clickeable como drilldown al tab correspondiente — igual que el resto de la app, donde la navegación se hace tocando el renglón, no botones.

## Alcance

Sólo presentación. Sin cambios de lógica, RPC, ni metadatos (`cierreCheckMeta.ts` se queda igual: las rutas y labels ya existen).

## Cambios

### `src/features/embarques/components/cierre/CierreCheckItem.tsx`

- Si el check está **pendiente** y tiene `ruta`: envolver toda la tarjeta en un `<Link>` (de `react-router-dom`) que apunta a `href`. La tarjeta entera se vuelve el área clickeable.
  - Estilos hover sutiles (`hover:bg-accent/40 hover:border-primary/40 transition-colors cursor-pointer`).
  - Mantiene `target="_blank"` (consistente con el comportamiento actual) y el icono pequeño `ExternalLink` discreto en la esquina superior derecha como pista visual de drilldown.
  - Se elimina el `<Button>` "Resolver / Ir a …".
- Si el check está **OK** o no tiene ruta: se renderiza como `<li>` normal sin link (no hay a dónde ir).
- Se conserva: ícono de estado (✓/✗), label, badge de responsable, detalle formateado y badge "OK / Pendiente".

### Bitácora

- `src/constants/appVersion.ts` → bump a `13.90.10`.
- `CHANGELOG.md` → entrada `[13.90.10]` describiendo: checklist de cierre ahora navega haciendo click en la fila completa (drilldown), se eliminó el botón "Resolver".

## Lo que NO cambia

- `cierreCheckMeta.ts`, `CierreChecklistCard.tsx`, el RPC `validar_cierre_embarque`, ni los tests de reglas.
- Las rutas destino, los labels, los responsables y los formatters siguen idénticos.

## Analogía

Hoy el checklist es como una lista del súper donde cada renglón tiene un botoncito "abrir" al lado. Lo cambiamos a que el renglón completo sea el "abrir" — como cuando tocas una fila de tu lista de embarques y entras a su detalle. Menos ruido visual, mismo destino.