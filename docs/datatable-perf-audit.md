# Auditoría de rendimiento — DataTable y VirtualDataTable

> APP_VERSION 10.1.2 · Fecha: 2026-05-19
>
> Fuente: `src/components/shared/dataTable/__tests__/DataTable.perf.test.tsx`
> (vitest + jsdom, ejecutable con `bun run test`).

## TL;DR

La virtualización **funciona como se espera**: el costo de montaje crece
sublineal respecto al tamaño del dataset (10× más filas → ~6× más tiempo),
y los rerenders con `data` de referencia estable son ~1ms gracias a la
memoización de `VirtualRow` y a la identidad estable del `rowModel` de
TanStack. **No se aplicaron optimizaciones nuevas**: la implementación que
quedó tras 9.1.3 (memo + estabilización de `gridTemplate`/`measureElement`/
`estimateSize`/`getRowId`) ya está en su óptimo razonable.

## Mediciones (jsdom)

| Escenario                                            | Tiempo  | Presupuesto | Resultado |
|------------------------------------------------------|---------|-------------|-----------|
| `DataTable` montaje 50 filas                         |  73.4ms | <100ms      | ✅        |
| `DataTable` rerender (data por referencia)           |  13.5ms | <30ms       | ✅        |
| `VirtualDataTable` montaje 1.000 filas               |  20.1ms | <250ms      | ✅        |
| `VirtualDataTable` montaje 5.000 filas               |  73.7ms | <500ms      | ✅        |
| `VirtualDataTable` montaje 10.000 filas              | 124.1ms | <900ms      | ✅        |
| `VirtualDataTable` rerender 5k (data por referencia) |   1.7ms | <60ms       | ✅        |

> Nota metodológica: jsdom **no calcula layout**, por lo que el browser
> real va a sumar el costo de pintado/composición de las ~10–15 filas que
> el viewport mantiene montadas en cada momento (las únicas que existen
> en el DOM gracias a `@tanstack/react-virtual`). El benchmark mide
> únicamente el costo del motor TanStack + reconciliación de React, que
> es el factor que históricamente nos dio problemas.

## Factor de escalado real

```
1k →  20.1ms   (20.1 µs/fila)
5k →  73.7ms   (14.7 µs/fila)
10k → 124.1ms  (12.4 µs/fila)
```

El costo **por fila** baja conforme crece el dataset porque el overhead
fijo (creación del header, `useReactTable`, virtualizer) se amortiza.
Esto confirma que **no hay trabajo cuadrático** en la cadena
`useTableInstance → useReactTable → rowModel → useVirtualizer`.

## Por qué el rerender de 5k toma 1.7ms

Tres optimizaciones combinadas (todas ya en el repo desde 9.1.3 y la
Fase 3):

1. **TanStack preserva la identidad de `rowModel.rows`** cuando `data`
   no cambia de referencia. `VirtualRow` recibe la misma `row` y
   `React.memo(VirtualRow, areEqual)` corta el render.
2. **`gridTemplate`, `measureElement`, `estimateSize` y `getRowId`** son
   estables entre renders (memo/callback), así que `useVirtualizer` no
   re-observa filas ni recalcula offsets.
3. **`getSortedRowModel` está deshabilitado** en `VirtualDataTable`
   (`enableSorting: false`): no hay paso de orden cliente que tocar al
   re-renderizar.

## Garantías que debemos mantener

Si alguno de estos invariantes se rompe, el rerender de 5k se dispara
de 1.7ms a 60+ms y volveremos a los problemas de scroll de versiones
previas:

- [ ] `data` debe llegar con identidad estable cuando no cambió de
      verdad. Usar `useMemo` en hooks de Supabase y evitar
      `data: rawRows.filter(...)` inline en JSX.
- [ ] `columns` debe declararse a nivel de módulo o memorizarse.
- [ ] `rowKey`, `onRowClick`, `rowClassName` deben ser estables
      (declarar fuera del componente o `useCallback`).
- [ ] No volver a meter `useMemo([...data].sort(...))` ni `useEffect`
      que rehidrate orden. TanStack es la única fuente de verdad.
- [ ] No reintroducir `getSortedRowModel` en `VirtualDataTable` salvo
      que se acompañe de paginación cliente real.

## Cuándo elegir cada tabla

| Volumen esperado    | Componente            | Por qué                                |
|---------------------|-----------------------|-----------------------------------------|
| ≤ 50 filas visibles | `DataTable`           | Más simple, soporta sort y paginación. |
| 50–200 con paginación server | `DataTable` + `pagination` | El motor sólo recibe la página actual. |
| 200+ sin paginación natural (logs, audit, payloads) | `VirtualDataTable` | Sólo se montan las filas visibles. |
| Filas con altura variable   | `VirtualDataTable` | `measureElement` ajusta automáticamente. |

## Próximos pasos posibles (no urgentes)

- Si en el browser real algún módulo (audit log, idempotencia) excede
  10k filas, agregar un benchmark con Playwright midiendo INP durante
  scroll y FPS sostenido.
- Considerar `react-window` como fallback si `@tanstack/react-virtual`
  llegara a dar problemas con altura variable extrema (cells con
  contenido editable expandible).
- Para datasets en los que el usuario filtra mucho en cliente, evaluar
  exponer `sortMode="client"` en `VirtualDataTable` (hoy está fijado
  en false). No urgente, no hay caso de uso pidiéndolo.

## Referencias

- `src/components/shared/VirtualDataTable.tsx`
- `src/components/shared/VirtualRow.tsx` — `React.memo` + comparador.
- `src/components/shared/dataTable/useTableInstance.ts`
- `src/components/shared/dataTable/__tests__/DataTable.perf.test.tsx`
- Historial: `src/content/changelog/v8/chunks/0.ts` (9.1.3, 10.0.0, 10.1.2).
