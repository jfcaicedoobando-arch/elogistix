# Los expedientes cancelados no deben aparecer en alertas de demora

## Causa confirmada

El ELIMP00353 está **Cancelado** (sin borrado lógico), es marítimo de importación con salida 07/08/2026 y llegada 26/08/2026.

Los cálculos del sistema estiman el "estado real" por fechas cuando el estado guardado no es uno de los avanzados: como hoy ya pasó la fecha de llegada, el expediente se recalcula como "Arribo" y entra al conteo de demoras. El filtro que excluye cancelados se aplica **después** de ese recalculo, así que ya venía convertido en "Arribo" y se colaba. El caso "Borrador" sí está protegido explícitamente; "Cancelado" no.

Hoy hay 1 expediente cancelado en esa situación: exactamente el 353.

## Qué se va a corregir

Que un expediente cancelado (o borrador) conserve su estado en todos esos cálculos y por tanto nunca se cuente como llegada ni como demora. Se toca en los seis cálculos que comparten la misma fórmula:

- Alertas de demora del listado de embarques y el desglose por tipo.
- Contador del aviso lateral (badge).
- Tarjeta "Alertas de Demora" y resumen del tablero.
- Estadísticas del tablero y del módulo de operaciones.

## Qué NO cambia

- No se toca ningún dato del expediente 353 ni de ningún otro: es sólo la fórmula de lectura.
- No cambian estados, fechas, importes, garantías, facturación ni reglas de cierre.
- No se agregan pantallas, filtros ni funciones nuevas.

## Efecto para el usuario

El 353 desaparece de la tarjeta de demoras, del contador lateral y de los conteos de embarques activos. Los cancelados siguen consultables en el listado con su filtro de estado.

## Detalle técnico

- Una migración `CREATE OR REPLACE FUNCTION` para: `embarques_alertas_ids`, `sidebar_alert_counts`, `dashboard_stats`, `_dashboard_details_calc`, `_dashboard_summary_calc`, `operaciones_stats`.
- Cambio único y homogéneo en el `CASE ... AS estado_real`: añadir `WHEN e.estado IN ('Cancelado') THEN e.estado::text` junto al guard existente de `Borrador`, antes de la derivación por ETD/ETA.
- En `embarques_alertas_ids` y `sidebar_alert_counts` (que no materializan `estado_real`) se añade además el guard `AND e.estado NOT IN ('Cancelado','Borrador')` a la rama de demora, coherente con el resto.
- Se preservan firma, `STABLE`, `SECURITY DEFINER`, `SET search_path`, `org_scope()` y `deleted_at IS NULL`; sin cambios de grants ni RLS.
- Regresión: prueba de dominio/servicio que verifica que la rama de demora excluye estado `Cancelado` con ETA vencida.
- Cierre: bump de `APP_VERSION`, entrada en `CHANGELOG.md`, `bun run db:postcheck` + baseline regenerada y `audit:manifest`. Typecheck/ESLint focalizados. Sin CI/RLS/Vitest/E2E globales locales.
