# Cotizaciones eliminadas siguen apareciendo en la tabla

## Qué pasa

La COT-2026-0214 sí se eliminó: en la base quedó marcada como borrada el 26/08 a las 14:30 (hora de México). El problema es que la consulta que llena la tabla de Cotizaciones no excluye los registros borrados, así que la sigue trayendo como si estuviera viva.

Es como tachar un renglón en la libreta pero seguir leyéndolo al sumar: el borrado está bien hecho, la lectura no lo respeta.

## Alcance de la falla

La misma omisión existe en varias lecturas de cotizaciones, no sólo el listado:

- Listado principal de Cotizaciones (el bug reportado).
- Buscador de cotizaciones aceptadas al vincular/editar embarques.
- Pendientes de reaprobación.
- Cotizaciones relacionadas en el detalle de cliente.
- CRM: cotizaciones sin respuesta, cotizaciones por oportunidad.

Todas pueden mostrar cotizaciones ya eliminadas o dejarlas vinculables.

## Qué se va a hacer

1. Excluir cotizaciones eliminadas en todas las lecturas anteriores.
2. En el detalle de una cotización: si el registro está eliminado, tratarlo como inexistente (mensaje "Cotización no encontrada") en lugar de abrirla y permitir editarla.
3. Verificar que el CRM/Cliente 360 y el portal de clientes (que ya filtran) sigan consistentes.
4. Agregar pruebas que fallen si alguna de estas consultas vuelve a omitir el filtro, para que no se repita.

## Detalles técnicos

- `src/features/cotizacion/services/queries.ts`: agregar `.is("deleted_at", null)` en `fetchCotizaciones`, `fetchCotizacionesAceptadas` y validar en `fetchCotizacionById` (retornar `null` si `deleted_at != null`).
- `src/features/cotizacion/services/pendientesReaprobacion.ts`, `src/features/cliente/services/relacionados.ts`, `src/features/crm/services/cotizacionesSinRespuesta.ts`, `src/features/crm/services/oportunidadCotizaciones.ts`: mismo filtro.
- Tests en `src/features/cotizacion/services/__tests__/queries.test.ts` (patrón ya existente que verifica `opArgs` de `.is`) y casos equivalentes para los servicios de CRM/cliente.
- Sin cambios de base de datos: el borrado lógico y las políticas actuales están correctos.
- `APP_VERSION` + `CHANGELOG.md` según convención.
