# Ola 3 — "Un solo equipo de diseño"

Pulido visual transversal del major release: puro frontend + guardias de CI, cero cambios de base de datos.

El diff que subiste (82 archivos) todavía no está aplicado en el proyecto: los candados `no-kpi-size-literal` y `no-raw-callout` no existen y el ratchet de uppercase sigue en 146. Ese diff cubre O3.1, O3.2, O3.5, O3.7, O3.8, O3.9 y O3.13.

## Fase 1 — Aplicar el trabajo ya preparado

Replico el contenido del diff archivo por archivo (no se puede aplicar con git en este entorno):

- O3.1 · Diálogo de eliminar factura de CxP al patrón canónico `DoubleConfirmDeleteDialog` (con slot para el resumen financiero), sin `h2` crudo.
- O3.2 · Cifras destacadas al token `text-kpi tabular-nums` + candado nuevo `no-kpi-size-literal`.
- O3.5 · Micro-etiquetas a `text-overline`; el ratchet de uppercase baja de 146 a 131.
- O3.7 · Fixes visibles con evidencia: tarjetas de arribos que se cortaban, contador de leads, KPI del portal, carril "Sin etapa" del Kanban, estado vacío con búsqueda activa, diálogo de eliminar usuario, filtros truncados.
- O3.8 · `Alert` canónico con variantes y slot de acción + migración de banners artesanales + candado `no-raw-callout`.
- O3.9 · Porcentajes y tipo de cambio por `formatPercent` / `formatTipoCambio`; baja el ratchet de `.toFixed(`.
- O3.13 · Login contextual por audiencia (portal de clientes / agentes) y regreso a la ruta destino.

Verificación: build en verde, `vitest` completo (incluidos los candados nuevos), y revisión visual con navegador de `/inicio`, `/crm/leads`, CxP y portal.

## Fase 2 — Lo que el diff no trae

- O3.3 · `DialogTitle` con `text-section` incorporado y limpieza de tipografía en los call-sites.
- O3.4 · Copy de validación centralizado (`COPY_VALIDACION` o mapa global de zod en español).
- O3.6 · Barrido de copy en español: sentence case en títulos y botones, casing único para nombres de cliente, "Profit" → "Utilidad" en pantalla (sin tocar el dato fiscal).

## Fase 3 — Bloque B estructural

- O3.10 · `Loader2` dentro de botones → prop `loading` (~68 archivos).
- O3.11 · Tiles KPI artesanales → `KpiCard` / `KpiStrip`, una variante por tamaño y no por módulo.
- O3.12 · Tipografía de portales y pantallas auth/legal a la escala del sistema, documentada en `docs/design-system.md`.
- O3.14 · Estrategia móvil para listados densos (Facturación, CxP, Tesorería).
- O3.15 · `MoneyCell` en listas móviles, una sola vía de `formatFechaHora*`, paleta cerrada de etapas CRM con contraste verificado.

## Notas técnicas

- Cada fase cierra con entrada en `CHANGELOG.md` y bump de `APP_VERSION` (Fase 1 → `13.711.0`).
- Las guardias nuevas entran con baseline en 0 y al final de su bloque, para no romper CI a media migración.
- Sin migraciones ni cambios de RPC en toda la ola.

## Antes de empezar

¿Ejecuto las tres fases seguidas en esta sesión, o prefieres que entregue y valide la Fase 1 primero?
