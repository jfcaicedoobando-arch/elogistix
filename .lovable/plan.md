## Diagnóstico

Probé los headers en la preview y el click sí dispara el sort de TanStack — la lógica está bien (`enableSorting`, `sortingFn`, `getToggleSortingHandler` en `DataTableHeaderRow`).

El síntoma real está en el session replay: al abrir el `Select` "Moneda" en los filtros de CXP, Radix puso en el `<body>`:

```html
<body data-scroll-locked="1" style="pointer-events: none;">
```

Esto es correcto mientras el Select está abierto (Radix bloquea la página detrás). El problema es que **Radix a veces no limpia ese estilo al cerrar** — bug conocido cuando hay varios overlays (Select, Dropdown, Dialog) que se abren/cierran rápido o cuando uno se desmonta mientras otro abre. Cuando eso pasa, todo el `<body>` queda con `pointer-events: none` y **ningún click llega a nada** (headers, botones de fila, "Pagar"…). La página se ve normal pero está "congelada".

Coincide 1-a-1 con lo que reportas: estás en CXP, abriste filtros, y después los headers no responden.

## Fix

Hook global defensivo `useRadixPointerEventsRescue()` montado una sola vez en `App.tsx`:

1. Observa `document.body` con un `MutationObserver` sobre `style` y `data-scroll-locked`.
2. Cada vez que cambian, verifica si queda algún overlay abierto en el DOM con el selector:
   ```
   [data-radix-popper-content-wrapper] [data-state="open"],
   [role="dialog"][data-state="open"],
   [role="menu"][data-state="open"],
   [role="listbox"][data-state="open"]
   ```
3. Si **no** hay ninguno abierto pero el body sigue con `pointer-events: none` o `data-scroll-locked`, los quita. Esto es safe: si Radix reabre algo, vuelve a poner los atributos.
4. Cleanup del observer en el unmount (regla Power of 10).

Archivo nuevo: `src/hooks/shared/useRadixPointerEventsRescue.ts` (~40 líneas).
Edición mínima en `src/App.tsx`: llamar al hook dentro del componente raíz.

## Changelog / versión

- Bump `APP_VERSION` → `12.81.2` (patch).
- Entrada en `CHANGELOG.md`: `fix(ui): rescate global del scroll-lock de Radix — los headers de tablas y botones dejaban de responder tras abrir/cerrar Selects de filtros (CXP, Embarques, etc.) porque <body> quedaba con pointer-events:none.`

## Fuera de alcance

- No se modifica `DataTable`, columnas ni la lógica de sort (funcionan).
- No se cambia ningún Select / Dialog específico (el fix es transversal).
- No se agregan dependencias.
