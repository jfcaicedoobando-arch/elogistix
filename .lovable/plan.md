## Problema

En el módulo de Auditoría, la tarjeta roja dice "2 hallazgos en embarques con ETA vencida", pero al presionar **Revisar** la tabla muestra un conjunto distinto. El conteo y el filtro se calculan con reglas diferentes en dos lugares del código que nunca se sincronizaron.

## Causa raíz (verificada en el código)

La tarjeta usa `calcularVencimientos` (`src/features/auditoria/domain/ejecutivoAgregados.ts`), y el botón sólo pasa `soloVencidos: true`, que en `useHallazgosTablaState` se traduce a un único filtro: `etaHasta = new Date()`. Las diferencias:

1. **Fecha inclusiva vs exclusiva.** La tarjeta cuenta `eta < hoy` (estrictamente vencidas). La tabla filtra `eta <= hoy`, así que **incluye los embarques que arriban hoy** — que no están vencidos.
2. **Reglas con calendario propio.** La tarjeta excluye a propósito `REGLAS_CON_VENCIMIENTO_PROPIO` (cxp_vencida, cxc_vencida, proforma_vencida, etc.), porque su vencimiento no depende del ETA. La tabla **no las excluye**, así que agrega hallazgos que la tarjeta nunca contó.
3. **Definición distinta de "pendiente".** La tarjeta considera pendiente sólo lo que **no tiene ningún registro de revisión**; la tabla considera pendiente todo lo que **no esté marcado como "revisado"** (o sea, incluye los "en progreso").
4. **Zona horaria mezclada.** La tarjeta calcula "hoy" en UTC (`isoUtcDay`); la tabla lo calcula en horario de México (`hoyMx` / `todayLocalISO`). Entre las 18:00 y medianoche los dos "hoy" difieren en un día.

## Solución

Crear una única fuente de verdad para el concepto "hallazgo con ETA vencida" y hacer que tanto la tarjeta como la tabla la consuman.

### Cambios

1. **`src/features/auditoria/domain/ejecutivoAgregados.ts`**
   - Exportar un predicado puro `esHallazgoEtaVencida(hallazgo, hoyIso)` que encapsule las tres reglas: tiene ETA, no pertenece a `REGLAS_CON_VENCIMIENTO_PROPIO`, y `eta < hoyIso`.
   - `calcularVencimientos` pasa a usar ese predicado (mismo resultado, sin duplicar lógica).
   - Unificar "hoy" a horario de México (`hoyMx`) en lugar de UTC, para empatar con el resto de la app.

2. **`src/features/auditoria/hooks/hallazgosTablaFilters.ts`**
   - Agregar al contexto de filtrado una bandera `soloEtaVencida` y un predicado que reutilice `esHallazgoEtaVencida`, en vez de depender del rango de fechas.

3. **`src/features/auditoria/hooks/useHallazgosTablaState.ts`**
   - Cuando llega `soloVencidos: true`, activar la bandera nueva en lugar de precargar `etaHasta = new Date()`. Así el drill-down aplica exactamente la misma regla que el conteo, y el filtro de rango de ETA queda libre para el usuario.

4. **Alinear la definición de "pendiente"**
   - En la tabla, cuando el drill-down viene de la tarjeta, forzar `filtroRevision = "pendientes"` y excluir también los "en progreso", igual que hace el cálculo del dashboard.

5. **Feedback visible en la tabla**
   - Mostrar un chip removible tipo "ETA vencida" en la barra de filtros cuando el drill-down esté activo, para que quede claro por qué la lista está acotada y se pueda quitar con un clic.

### Verificación

- Tests unitarios nuevos en `ejecutivoAgregados` y `hallazgosTablaFilters` que comprueben la paridad: dado el mismo arreglo de hallazgos, el número que cuenta la tarjeta debe ser idéntico al número de filas que deja pasar el filtro (incluyendo casos borde: ETA justo hoy, regla con calendario propio, hallazgo en progreso).
- Prueba manual contra los datos reales: confirmar que la tarjeta y la tabla muestran ambas 2.
- Correr lint y la suite de tests de auditoría.

### Detalle técnico

Sin cambios de base de datos ni de RPC — todo el desajuste es de lógica de presentación en el cliente. Se actualizará `APP_VERSION` y `CHANGELOG.md`.
