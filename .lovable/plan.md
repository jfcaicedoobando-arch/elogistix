## Problema

En la tabla de embarques, el embarque 273 (LCL) muestra "datos pendientes" en la columna **Contenedores** porque la lógica actual cuenta como "incompleto" cualquier contenedor hijo sin número o sin tipo. En LCL eso es normal: el agente de carga consolida nuestra mercancía con la de otros clientes y muchas veces nunca nos comparte el número/tipo del contenedor físico.

**Analogía:** es como pedirle al chofer de un Uber Pool la placa del coche cuando todavía no llega — para los demás pasajeros (FCL) sí tiene sentido exigirlo, pero para ti que vas en pool (LCL) ese dato no depende de ti.

## Solución elegida

**Opcional total en LCL.** Cuando `tipo_carga === "LCL"`:
- No marcar como "datos pendientes" por contenedor faltante.
- El **BL Master** sigue siendo obligatorio en marítimo (igual que hoy) — eso no cambia.
- La celda muestra `LCL · sin contenedor asignado` (con guion `—` para el número) en lugar del badge naranja de pendientes.

Para FCL marítimo y todo lo demás, la lógica actual se queda intacta.

## Cambios técnicos

1. **`src/features/embarques/utils/estadoContenedorCell.ts`**
   - Aceptar `tipo_carga` en el `Pick<EmbarqueRow, ...>` del argumento.
   - Si `tipo_carga === "LCL"`: forzar `incompletos = 0` y no incluir el aviso de contenedores en `pendientesTitle`. `blFalta` (BL Master) sigue calculándose igual.

2. **`src/features/embarques/components/embarqueColumns.tsx`**
   - Pasar `tipo_carga` del row a `derivarEstadoContenedor`.
   - En el render de la celda, si LCL y no hay número, mostrar `LCL` como etiqueta secundaria en vez de "1 contenedor pendiente".

3. **`src/features/embarques/services/columns.ts`**
   - Verificar que `tipo_carga` ya viene en el SELECT del listado (sí está en `EMBARQUE_LIST_COLUMNS` según la búsqueda). Si falta en alguna query del listado, agregarlo.

4. **`src/features/embarques/utils/__tests__/estadoContenedorCell.test.ts`**
   - Agregar 2 casos: LCL con contenedores incompletos → `pendientes=false`; LCL sin BL Master → `pendientes=true` (solo por BL, no por contenedor).

## Fuera de alcance

- Validaciones del wizard de embarque (paso 1) y de proforma (`validarContenedoresFCL.ts`) — ya excluyen LCL por su nombre, no se tocan.
- Lógica de cierre (`cierreCheckFormatters.ts`) — sigue contando contenedores incompletos donde aplique; revisarla sería otro alcance.
- Aéreo y terrestre — no afectados.

## Entregables

- Bump a `13.127.1` (parche, cambio de presentación + lógica de derivación).
- Entrada en `CHANGELOG.md`: "LCL: contenedor opcional, ya no marca datos pendientes."
- `tsgo` y vitest del archivo modificado en verde.
