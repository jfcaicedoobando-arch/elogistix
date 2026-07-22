# Ordenar embarques por folio (asc) en "Capturar factura de proveedor"

Actualmente, dentro del modal **Capturar factura de proveedor → Vincular costos**, los grupos de conceptos pendientes se muestran agrupados por embarque en el orden en que llegan de la consulta (aparentemente por fecha o por concepto), lo que hace difícil ubicar un embarque específico.

## Cambio

Ordenar los grupos por número de expediente de menor a mayor.

### Detalle técnico

- Archivo: `src/features/cxp/components/vincularEmbarqueHelpers.ts`
- Función: `agruparPorEmbarque(items)`
  - Al final, ordenar `Array.from(map.values())` por `expediente` usando comparación natural (`localeCompare` con `{ numeric: true, sensitivity: "base" }`), para que `EXP-002` vaya antes de `EXP-010`.
- El orden se preserva a través de `filtrarGrupos` (que sólo filtra, no reordena) y de `VincularListaConceptos` (que hace `map` directo).

### Tests

- Añadir un caso en `src/features/cxp/components/__tests__/vincularEmbarqueHelpers.test.ts` sobre `agruparPorEmbarque`: dado un arreglo con expedientes `EXP-010`, `EXP-002`, `EXP-001`, el resultado debe salir en orden `EXP-001`, `EXP-002`, `EXP-010`.

### Changelog / versión

- `APP_VERSION` → `13.307.11`.
- Entrada breve en `CHANGELOG.md` explicando el orden ascendente por folio de embarque.

## Fuera de alcance

- No se toca el orden interno de conceptos dentro de cada embarque.
- No se agregan controles de orden configurables por el usuario.
